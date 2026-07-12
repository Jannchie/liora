import type { RecomposeCropRect, RecomposeParams } from '#shared/types/recompose'
import { computed, reactive, ref } from 'vue'
import {
  clampCropRect,
  computeFramedDims,
  computeRecomposePlane,
  createDefaultRecomposeParams,
  fitCropToBounds,
  isIdentityRecompose,
} from '#shared/utils/recompose'

const MIN_CROP_SIZE = 0.05

interface RecomposeEditorSource {
  width: number
  height: number
  recompose: RecomposeParams | null | undefined
}

function cloneParams(params: RecomposeParams): RecomposeParams {
  return {
    ...params,
    crop: { ...params.crop },
    original: { ...params.original },
  }
}

function clampCrop(crop: RecomposeCropRect): RecomposeCropRect {
  return clampCropRect(crop, MIN_CROP_SIZE)
}

export function useRecomposeEditor(source: RecomposeEditorSource) {
  const initial = source.recompose
    ? cloneParams(source.recompose)
    : createDefaultRecomposeParams(
        // Without a stored framing, File.width/height are the original display dims.
        { width: source.width, height: source.height },
      )
  const params = reactive<RecomposeParams>(cloneParams(initial))
  /** Locked crop aspect (width/height in plane pixels), null = free. */
  const lockedAspect = ref<number | null>(null)

  const plane = computed(() => computeRecomposePlane(params))
  const framedDims = computed(() => computeFramedDims(params))
  const isIdentity = computed(() => isIdentityRecompose(params))

  /** Shrink the crop (keeping its center and aspect) until it fits the image quad. */
  function constrainCrop(): void {
    const currentAspect = (params.crop.width * plane.value.planeWidth) / (params.crop.height * plane.value.planeHeight)
    const fitted = fitCropToBounds(params, Number.isFinite(currentAspect) && currentAspect > 0 ? currentAspect : null)
    if (params.crop.width > fitted.width || params.crop.height > fitted.height) {
      params.crop = clampCrop(fitted)
    }
  }

  function setCrop(crop: RecomposeCropRect): void {
    params.crop = clampCrop(crop)
  }

  function applyAspect(aspect: number | null): void {
    lockedAspect.value = aspect
    params.crop = clampCrop(fitCropToBounds(params, aspect))
  }

  function setStraighten(value: number): void {
    params.straighten = value
    constrainCrop()
  }

  function setStretch(axis: 'x' | 'y', value: number): void {
    if (axis === 'x') {
      params.stretchX = value
    }
    else {
      params.stretchY = value
    }
    constrainCrop()
  }

  function setPerspective(axis: 'h' | 'v', value: number): void {
    if (axis === 'h') {
      params.perspectiveH = value
    }
    else {
      params.perspectiveV = value
    }
    constrainCrop()
  }

  /**
   * Rotate the VIEW by 90°. Composing a screen-space rotation through the
   * transform pipeline swaps the stretch axes and rotates the perspective
   * vector; the crop rect maps exactly because the plane rotates rigidly.
   */
  function rotate90(direction: 1 | -1): void {
    const { x, y, width, height } = params.crop
    if (direction === 1) {
      // Clockwise on screen.
      params.rotate90 = (((params.rotate90 + 1) % 4) + 4) % 4 as RecomposeParams['rotate90']
      ;[params.stretchX, params.stretchY] = [params.stretchY, params.stretchX]
      ;[params.perspectiveH, params.perspectiveV] = [-params.perspectiveV, params.perspectiveH]
      params.crop = clampCrop({ x: 1 - (y + height), y: x, width: height, height: width })
    }
    else {
      params.rotate90 = (((params.rotate90 - 1) % 4) + 4) % 4 as RecomposeParams['rotate90']
      ;[params.stretchX, params.stretchY] = [params.stretchY, params.stretchX]
      ;[params.perspectiveH, params.perspectiveV] = [params.perspectiveV, -params.perspectiveH]
      params.crop = clampCrop({ x: y, y: 1 - (x + width), width: height, height: width })
    }
    if (lockedAspect.value) {
      lockedAspect.value = 1 / lockedAspect.value
    }
    constrainCrop()
  }

  /**
   * Mirror the VIEW horizontally/vertically. A screen-space flip conjugated
   * through the pipeline negates the straighten angle, one perspective axis,
   * and reflects the rotate90 step, so the on-screen result is a pure mirror.
   */
  function flip(axis: 'h' | 'v'): void {
    params.rotate90 = (((4 - params.rotate90) % 4) + 4) % 4 as RecomposeParams['rotate90']
    params.straighten = -params.straighten
    if (axis === 'h') {
      params.flipH = !params.flipH
      params.perspectiveH = -params.perspectiveH
      params.crop = clampCrop({ ...params.crop, x: 1 - (params.crop.x + params.crop.width) })
    }
    else {
      params.flipV = !params.flipV
      params.perspectiveV = -params.perspectiveV
      params.crop = clampCrop({ ...params.crop, y: 1 - (params.crop.y + params.crop.height) })
    }
  }

  function reset(): void {
    const defaults = createDefaultRecomposeParams(params.original)
    Object.assign(params, defaults, { crop: { ...defaults.crop }, original: { ...defaults.original } })
    lockedAspect.value = null
  }

  return {
    params,
    lockedAspect,
    plane,
    framedDims,
    isIdentity,
    setCrop,
    constrainCrop,
    applyAspect,
    setStraighten,
    setStretch,
    setPerspective,
    rotate90,
    flip,
    reset,
  }
}
