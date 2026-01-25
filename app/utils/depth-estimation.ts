import type { DepthEstimationPipeline, DepthEstimationPipelineOutput } from '@xenova/transformers'

export interface DepthEstimateOptions {
  maxSize?: number
}

export interface DepthEstimateResult {
  depthBlob: Blob
  width: number
  height: number
  model: string
}

type TransformersModule = typeof import('@xenova/transformers')
type RawImageInstance = InstanceType<TransformersModule['RawImage']>

const MODEL_NAME = 'Xenova/dpt-hybrid-midas'
const DEFAULT_MAX_SIZE = 512
const MIN_MAX_SIZE = 128
const MAX_MAX_SIZE = 2048

let transformersPromise: Promise<TransformersModule> | null = null
let pipelinePromise: Promise<DepthEstimationPipeline> | null = null

function parseMaxSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_MAX_SIZE
  }
  const clamped = Math.round(value)
  return Math.min(MAX_MAX_SIZE, Math.max(MIN_MAX_SIZE, clamped))
}

async function loadTransformers(): Promise<TransformersModule> {
  if (!transformersPromise) {
    transformersPromise = import('@xenova/transformers')
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
      env.allowRemoteModels = true
      env.allowLocalModels = false
      env.useBrowserCache = true
      const maxThreads = Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency ?? 4) / 2)))
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
    if (output.length === 0) {
      throw new Error('Depth estimation returned empty result.')
    }
    return output[0]
  }
  return output
}

async function loadImageFromUrl(imageUrl: string, maxSize: number): Promise<{ image: RawImageInstance, width: number, height: number }> {
  const { RawImage } = await loadTransformers()
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  const blob = await response.blob()
  const image = await RawImage.fromBlob(blob)
  const width = image.width
  const height = image.height
  const maxDimension = Math.max(width, height)
  if (maxDimension > maxSize) {
    const scale = maxSize / maxDimension
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))
    await image.resize(targetWidth, targetHeight)
  }
  image.rgb()
  return { image, width: image.width, height: image.height }
}

export async function estimateDepthFromUrl(imageUrl: string, options: DepthEstimateOptions = {}): Promise<DepthEstimateResult> {
  if (!import.meta.client) {
    throw new Error('Depth estimation is only available in the browser.')
  }
  const trimmedUrl = imageUrl.trim()
  if (!trimmedUrl) {
    throw new Error('Image URL is required.')
  }
  const maxSize = parseMaxSize(options.maxSize)
  const depthEstimator = await getDepthPipeline()
  const { image } = await loadImageFromUrl(trimmedUrl, maxSize)
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
