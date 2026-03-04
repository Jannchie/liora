import { requireFileFromRouterParam } from '../../../../utils/file-record'
import { resolveBaseName } from '../../../../utils/live-photo'
import { parseLivePhotoShareMetadata, serveLivePhotoAsset } from '../../../../utils/live-photo-delivery'

export default defineEventHandler(async (event) => {
  const file = await requireFileFromRouterParam(event, 'id', 'Invalid file id.')

  const metadata = parseLivePhotoShareMetadata(file.metadata)
  const baseName = resolveBaseName(file.title || file.originalName || `live-photo-${file.id}`)
  const videoFileName = `${baseName}.mov`
  return serveLivePhotoAsset({
    event,
    file,
    metadata,
    asset: 'video',
    contentType: 'video/quicktime',
    filename: videoFileName,
  })
})
