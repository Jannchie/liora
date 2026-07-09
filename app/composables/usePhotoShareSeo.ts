import type { FileResponse } from '~/types/file'
import { computed, watchEffect } from 'vue'
import { defineOgImage, useSeoMeta } from '#imports'

function normalizeRouteParam(param: string | string[] | null | undefined): string {
  if (Array.isArray(param)) {
    return param.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) ?? ''
  }
  return typeof param === 'string' ? param : ''
}

function joinParts(parts: Array<string | undefined>, separator: string): string {
  return parts
    .map(part => part?.trim() ?? '')
    .filter(part => part.length > 0)
    .join(separator)
}

/* Satori has no line clamping — an unbounded title walks over the meta block. */
function truncate(value: string | undefined, maxLength: number): string {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed
}

/**
 * Photo-specific share metadata for any page whose route ends in
 * `/photo/:id` (the gallery home and series details both do). The gallery
 * data is otherwise fetched client-side, so crawlers would only ever see
 * the site-wide card — this fetch runs during SSR so the OG image and meta
 * can feature the photo itself.
 *
 * Call it *after* the page's own `useSeoMeta`/`defineOgImage`: the photo
 * overrides only apply when the photo resolves, and later head entries win.
 */
export async function usePhotoShareSeo(): Promise<void> {
  const nuxtApp = useNuxtApp()
  const { t } = useI18n()
  const route = useRoute()
  const image = useImage()
  const siteConfig = useSiteConfig()

  const routePhotoId = computed<number | null>(() => {
    if (normalizeRouteParam(route.params.section) !== 'photo') {
      return null
    }
    const parsed = Number.parseInt(normalizeRouteParam(route.params.id), 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  })

  // Deliberately not awaited yet: every composable below needs the current
  // instance, and an await inside a composable (unlike one at the top level
  // of <script setup>) does not restore it afterwards. Register everything
  // first, then block on the fetch at the end.
  const asyncData = useAsyncData<FileResponse | null>(
    'shared-photo',
    async () => {
      if (!routePhotoId.value) {
        return null
      }
      try {
        return await $fetch<FileResponse>(`/api/files/${routePhotoId.value}`)
      }
      catch {
        // Missing photo falls back to the page's own card.
        return null
      }
    },
    { watch: [routePhotoId] },
  )
  const sharedPhoto = asyncData.data

  const photoTitle = computed<string | undefined>(() => {
    const photo = sharedPhoto.value
    if (!photo) {
      return
    }
    return photo.title.trim()
      || photo.fanworkTitle.trim()
      || photo.originalName.trim().replace(/\.[a-z0-9]+$/i, '')
      || t('common.labels.untitled')
  })

  const photoDescription = computed<string | undefined>(() => {
    const description = sharedPhoto.value?.description.trim()
    return description && description.length > 0 ? description : undefined
  })

  const photoCamera = computed(() => joinParts(
    [sharedPhoto.value?.metadata.cameraModel, sharedPhoto.value?.metadata.lensModel],
    ' · ',
  ))

  const photoExposure = computed(() => {
    const metadata = sharedPhoto.value?.metadata
    const iso = metadata?.iso.trim()
    return joinParts(
      [
        metadata?.aperture,
        metadata?.shutterSpeed,
        metadata?.focalLength,
        iso ? `ISO ${iso}` : undefined,
      ],
      ' · ',
    )
  })

  /* Satori cannot decode webp/avif, and originals can be either — route the
     photo through IPX as a downscaled jpeg instead of embedding it raw. */
  const photoOgImageUrl = computed(() => {
    const source = sharedPhoto.value?.imageUrl.trim()
    if (!source) {
      return ''
    }
    return image(source, { format: 'jpeg', width: 1200, quality: 82 })
  })

  // The getters resolve when the head is serialized — after the await
  // below — so they already see the fetched photo during SSR.
  useSeoMeta({
    title: () => photoTitle.value,
    ogTitle: () => photoTitle.value,
    description: () => photoDescription.value,
    ogDescription: () => photoDescription.value,
    ogType: () => (sharedPhoto.value ? 'article' : undefined),
  })

  function applyPhotoOgImage(): void {
    const photo = sharedPhoto.value
    if (!photo || !photoOgImageUrl.value) {
      return
    }
    defineOgImage('LioraPhotoCard', {
      imageUrl: photoOgImageUrl.value,
      siteName: siteConfig.name,
      // The camera line stands in when EXIF is absent (e.g. illustrations).
      exposure: truncate(photoExposure.value || photoCamera.value, 90),
    }, {
      alt: photoTitle.value,
    })
  }

  // Keeps the head in sync across client-side photo navigation. Registered
  // before the await so it is scoped to the component and auto-disposed.
  watchEffect(applyPhotoOgImage)

  await asyncData

  // During SSR the watchEffect above ran once, before the fetch resolved,
  // and never re-runs — apply the resolved photo explicitly. runWithContext
  // restores the Nuxt context the await just discarded.
  if (import.meta.server) {
    nuxtApp.runWithContext(applyPhotoOgImage)
  }
}
