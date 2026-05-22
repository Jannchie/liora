import { estimateDepthFromUrl } from '~/utils/depth-estimation'

async function uploadDepthMap(params: {
  fileId: number
  imageUrl: string
  missingImageMessage: string
}): Promise<void> {
  const normalizedImageUrl = params.imageUrl.trim()
  if (!normalizedImageUrl) {
    throw new Error(params.missingImageMessage)
  }
  const { depthBlob } = await estimateDepthFromUrl(normalizedImageUrl)
  const extension = depthBlob.type === 'image/webp' ? 'webp' : 'png'
  const formData = new FormData()
  formData.append('depth', depthBlob, `depth-${params.fileId}.${extension}`)
  await $fetch(`/api/files/${params.fileId}/depth`, {
    method: 'POST',
    body: formData,
  })
}

export function useDepthMapUpload(): {
  uploadDepthMap: (params: {
    fileId: number
    imageUrl: string
    missingImageMessage: string
  }) => Promise<void>
} {
  return { uploadDepthMap }
}
