declare module '@xenova/transformers/src/backends/onnx.js' {
  export const executionProviders: string[]
  export const ONNX: {
    env?: Record<string, unknown>
  }
}
