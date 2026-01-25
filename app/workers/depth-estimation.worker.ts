import type { DepthEstimationPipeline, DepthEstimationPipelineOutput } from '@xenova/transformers'

interface DepthEstimateResult {
  depthBlob: Blob
  width: number
  height: number
  model: string
}

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

type TransformersModule = typeof import('@xenova/transformers')
type RawImageInstance = InstanceType<TransformersModule['RawImage']>

const MODEL_NAME = 'Xenova/dpt-hybrid-midas'
const DEFAULT_SCALE_FACTOR = 0.25
const MIN_SCALE_FACTOR = 0.01
const MAX_SCALE_FACTOR = 1

let transformersPromise: Promise<TransformersModule> | null = null
let pipelinePromise: Promise<DepthEstimationPipeline> | null = null

function parseScaleFactor(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_SCALE_FACTOR
  }
  return Math.min(MAX_SCALE_FACTOR, Math.max(MIN_SCALE_FACTOR, value))
}

async function loadTransformers(): Promise<TransformersModule> {
  if (!transformersPromise) {
    transformersPromise = import('@xenova/transformers')
  }
  return transformersPromise
}

async function getDepthPipeline(): Promise<DepthEstimationPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { env, pipeline } = await loadTransformers()
      env.allowRemoteModels = true
      env.allowLocalModels = false
      env.useBrowserCache = true
      const cpuCount = globalThis.navigator?.hardwareConcurrency ?? 4
      const maxThreads = Math.max(1, Math.min(4, Math.floor(cpuCount / 2)))
      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = maxThreads
      }
      return pipeline('depth-estimation', MODEL_NAME)
    })()
  }
  return pipelinePromise
}

async function resolveDepthOutput(output: DepthEstimationPipelineOutput | DepthEstimationPipelineOutput[]): Promise<DepthEstimationPipelineOutput> {
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

async function estimateDepth(imageUrl: string, scaleFactor: number): Promise<DepthEstimateResult> {
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

function handleMessage(event: MessageEvent<WorkerRequest>): void {
  const { id, imageUrl, scaleFactor } = event.data ?? {}
  if (typeof id !== 'number' || typeof imageUrl !== 'string') {
    return
  }
  const parsedScaleFactor = parseScaleFactor(scaleFactor)
  estimateDepth(imageUrl.trim(), parsedScaleFactor)
    .then((result) => {
      const response: WorkerResponse = { id, ok: true, result }
      self.postMessage(response)
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'Depth estimation failed.'
      const response: WorkerResponse = { id, ok: false, error: message }
      self.postMessage(response)
    })
}

self.addEventListener('message', handleMessage)
