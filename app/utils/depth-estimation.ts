import type { DepthEstimationOutput, DepthEstimationPipeline, DeviceType } from '@huggingface/transformers'

export interface DepthEstimateOptions {
  scaleFactor?: number
}

export interface DepthEstimateResult {
  depthBlob: Blob
  width: number
  height: number
  model: string
}

type TransformersModule = typeof import('@huggingface/transformers')
type RawImageInstance = InstanceType<TransformersModule['RawImage']>

const MODEL_NAME = 'Xenova/dpt-hybrid-midas'
const DEFAULT_SCALE_FACTOR = 0.25
const MIN_SCALE_FACTOR = 0.01
const MAX_SCALE_FACTOR = 1

let transformersPromise: Promise<TransformersModule> | null = null
let pipelinePromise: Promise<DepthEstimationPipeline> | null = null
let worker: Worker | null = null
let workerRequestId = 0
let preferredDeviceConfigured = false
let preferredDevice: DeviceType | null = null
const workerResolvers = new Map<number, {
  resolve: (value: DepthEstimateResult) => void
  reject: (error: Error) => void
}>()

interface WorkerRequest {
  id: number
  imageUrl: string
  scaleFactor: number
}

interface WorkerResponse {
  id: number
  ok: boolean
  result?: DepthEstimateResult
  error?: string
}

function parseScaleFactor(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_SCALE_FACTOR
  }
  return Math.min(MAX_SCALE_FACTOR, Math.max(MIN_SCALE_FACTOR, value))
}

function supportsWebGpu(): boolean {
  return globalThis.navigator !== undefined && 'gpu' in globalThis.navigator
}

function resolvePreferredDevice(): DeviceType | null {
  if (preferredDeviceConfigured) {
    return preferredDevice
  }
  preferredDeviceConfigured = true
  if (supportsWebGpu()) {
    preferredDevice = 'webgpu'
  }
  return preferredDevice
}

function resetWorkerWithError(error: Error): void {
  for (const resolver of workerResolvers.values()) {
    resolver.reject(error)
  }
  workerResolvers.clear()
  if (worker) {
    worker.terminate()
  }
  worker = null
}

function getDepthWorker(): Worker | null {
  if (!import.meta.client || typeof Worker === 'undefined') {
    return null
  }
  if (!worker) {
    worker = new Worker(new URL('../workers/depth-estimation.worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const payload = event.data
      if (!payload || typeof payload.id !== 'number') {
        return
      }
      const resolver = workerResolvers.get(payload.id)
      if (!resolver) {
        return
      }
      workerResolvers.delete(payload.id)
      if (payload.ok && payload.result) {
        resolver.resolve(payload.result)
        return
      }
      const message = payload.error || 'Depth estimation failed.'
      resolver.reject(new Error(message))
    })
    worker.addEventListener('messageerror', () => {
      resetWorkerWithError(new Error('Depth estimation worker message error.'))
    })
    worker.addEventListener('error', () => {
      resetWorkerWithError(new Error('Depth estimation worker error.'))
    })
  }
  return worker
}

async function loadTransformers(): Promise<TransformersModule> {
  if (!transformersPromise) {
    transformersPromise = import('@huggingface/transformers')
  }
  return transformersPromise
}

async function getDepthPipeline(): Promise<DepthEstimationPipeline> {
  if (!import.meta.client) {
    throw new Error('Depth estimation is only available in the browser.')
  }
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { env, pipeline } = await loadTransformers()
      const device = resolvePreferredDevice()
      env.allowRemoteModels = true
      env.allowLocalModels = false
      env.useBrowserCache = true
      const maxThreads = Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency ?? 4) / 2)))
      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = maxThreads
      }
      const pipelineOptions = device === null ? undefined : { device }
      return pipeline<'depth-estimation'>('depth-estimation', MODEL_NAME, pipelineOptions)
    })()
  }
  return pipelinePromise
}

async function resolveDepthOutput(output: DepthEstimationOutput | DepthEstimationOutput[]): Promise<DepthEstimationOutput> {
  if (Array.isArray(output)) {
    const [first] = output
    if (!first) {
      throw new Error('Depth estimation returned empty result.')
    }
    return first
  }
  return output
}

async function loadImageFromUrl(imageUrl: string, scaleFactor: number): Promise<{ image: RawImageInstance, width: number, height: number }> {
  const { RawImage } = await loadTransformers()
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  const blob = await response.blob()
  const image = await RawImage.fromBlob(blob)
  const width = image.width
  const height = image.height
  const clampedScale = Math.min(MAX_SCALE_FACTOR, Math.max(MIN_SCALE_FACTOR, scaleFactor))
  const targetWidth = Math.max(1, Math.round(width * clampedScale))
  const targetHeight = Math.max(1, Math.round(height * clampedScale))
  if (targetWidth !== width || targetHeight !== height) {
    await image.resize(targetWidth, targetHeight)
  }
  image.rgb()
  return { image, width: image.width, height: image.height }
}

async function estimateDepthInMainThread(imageUrl: string, scaleFactor: number): Promise<DepthEstimateResult> {
  const depthEstimator = await getDepthPipeline()
  const { image } = await loadImageFromUrl(imageUrl, scaleFactor)
  const output = await depthEstimator(image)
  const resolved = await resolveDepthOutput(output)
  const depthBlob = await resolved.depth.toBlob('image/png') as Blob
  return {
    depthBlob,
    width: resolved.depth.width,
    height: resolved.depth.height,
    model: MODEL_NAME,
  }
}

async function estimateDepthInWorker(imageUrl: string, scaleFactor: number): Promise<DepthEstimateResult> {
  const depthWorker = getDepthWorker()
  if (!depthWorker) {
    throw new Error('Depth estimation worker is unavailable.')
  }
  const id = workerRequestId + 1
  workerRequestId = id
  const request: WorkerRequest = { id, imageUrl, scaleFactor }
  return await new Promise<DepthEstimateResult>((resolve, reject) => {
    workerResolvers.set(id, { resolve, reject })
    try {
      depthWorker.postMessage(request)
    }
    catch (error) {
      workerResolvers.delete(id)
      const message = error instanceof Error ? error.message : 'Depth estimation worker failed.'
      reject(new Error(message))
    }
  })
}

export async function estimateDepthFromUrl(imageUrl: string, options: DepthEstimateOptions = {}): Promise<DepthEstimateResult> {
  if (!import.meta.client) {
    throw new Error('Depth estimation is only available in the browser.')
  }
  const trimmedUrl = imageUrl.trim()
  if (!trimmedUrl) {
    throw new Error('Image URL is required.')
  }
  const scaleFactor = parseScaleFactor(options.scaleFactor)
  const preferredDevice = resolvePreferredDevice()
  if (preferredDevice) {
    try {
      return await estimateDepthInMainThread(trimmedUrl, scaleFactor)
    }
    catch (error) {
      const fallbackWorker = getDepthWorker()
      if (fallbackWorker) {
        return await estimateDepthInWorker(trimmedUrl, scaleFactor)
      }
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Depth estimation failed.')
    }
  }
  const depthWorker = getDepthWorker()
  if (depthWorker) {
    try {
      return await estimateDepthInWorker(trimmedUrl, scaleFactor)
    }
    catch {
      return await estimateDepthInMainThread(trimmedUrl, scaleFactor)
    }
  }
  return await estimateDepthInMainThread(trimmedUrl, scaleFactor)
}
