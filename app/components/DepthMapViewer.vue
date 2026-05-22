<script setup lang="ts">
import type {
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderer,
} from 'three'
import type { Ref } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export interface DepthMapViewerExpose {
  play: () => void
  isReady: Ref<boolean>
  isLoading: Ref<boolean>
  isAnimating: Ref<boolean>
  isRevealing: Ref<boolean>
}

type DirectionMode = 'bottom-up' | 'top-down' | 'left-right' | 'right-left'

interface FocusBox {
  left: number
  top: number
  width: number
  height: number
}

interface DepthUniformValue<T> { value: T }
interface DepthUniforms extends Record<string, DepthUniformValue<unknown>> {
  uImage: DepthUniformValue<Texture | null>
  uDepth: DepthUniformValue<Texture | null>
  uResolution: DepthUniformValue<Vector2>
  uDirectionProgress: DepthUniformValue<number>
  uDepthProgress: DepthUniformValue<number>
  uMaxBlur: DepthUniformValue<number>
  uBlurEasePower: DepthUniformValue<number>
  uDirectionalDelay: DepthUniformValue<number>
  uDepthDelay: DepthUniformValue<number>
  uDepthCurvePower: DepthUniformValue<number>
  uDirectionMode: DepthUniformValue<number>
  uInvertDepth: DepthUniformValue<number>
  uUseDepth: DepthUniformValue<number>
}

type ThreeModule = typeof import('three')

const props = withDefaults(defineProps<{
  imageUrl: string
  depthUrl?: string
  placeholderUrl?: string
  placeholderAspectRatio?: number
  imageWidth?: number
  imageHeight?: number
  revealDurationMs?: number
  directionDurationSeconds?: number
  depthDurationSeconds?: number
  maxBlur?: number
  blurEasePower?: number
  directionalDelay?: number
  depthDelay?: number
  depthEasePower?: number
  directionMode?: DirectionMode
  invertDepth?: boolean
  autoPlay?: boolean
  focusBox?: FocusBox | null
}>(), {
  depthUrl: '',
  placeholderUrl: '',
  revealDurationMs: 600,
  directionDurationSeconds: 0,
  depthDurationSeconds: 2,
  blurEasePower: -2,
  directionalDelay: 0.1,
  depthDelay: 0.4,
  depthEasePower: 1.2,
  directionMode: 'bottom-up',
  invertDepth: false,
  autoPlay: true,
  focusBox: null,
})

const { t } = useI18n()

const wrapperRef = ref<HTMLDivElement | null>(null)
const canvasHost = ref<HTMLDivElement | null>(null)
const isLoading = ref(false)
const isReady = ref(false)
const isAnimating = ref(false)
const isRevealing = ref(false)
const showFinalImage = ref(false)
const revealProgress = ref(0)
const statusMessage = ref('')
let imageSize = { width: 1, height: 1 }
const containerWidth = ref(0)

const imageUrl = computed(() => props.imageUrl.trim())
const depthUrl = computed(() => props.depthUrl?.trim() ?? '')
const placeholderUrl = computed(() => props.placeholderUrl?.trim() ?? '')
const hasPlaceholder = computed(() => placeholderUrl.value.length > 0)
const hasDepth = computed(() => Boolean(depthUrl.value))
const canRender = computed(() => Boolean(imageUrl.value))
const effectiveMaxBlur = computed<number>(() => {
  if (typeof props.maxBlur === 'number' && Number.isFinite(props.maxBlur) && props.maxBlur > 0) {
    return props.maxBlur
  }
  const width = containerWidth.value
  return width > 0 ? Math.max(1, width / 4) : 1
})
const imageAspectRatio = computed<number | undefined>(() => {
  const width = props.imageWidth ?? 0
  const height = props.imageHeight ?? 0
  if (width <= 0 || height <= 0) {
    return
  }
  return width / height
})
const displayAspectRatio = computed(() => {
  const ratio = imageAspectRatio.value
  if (ratio && Number.isFinite(ratio) && ratio > 0) {
    return ratio
  }
  if (imageSize.width > 0 && imageSize.height > 0) {
    return imageSize.width / imageSize.height
  }
  return 1
})
const wrapperStyle = computed<Record<string, string> | undefined>(() => {
  const ratio = imageAspectRatio.value ?? props.placeholderAspectRatio
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return
  }
  return {
    aspectRatio: ratio.toString(),
    height: 'auto',
    width: '100%',
  }
})
const showOverlay = computed(() => {
  if (statusMessage.value.length > 0) {
    return true
  }
  if (!canRender.value && !hasPlaceholder.value) {
    return true
  }
  if (isLoading.value && !hasPlaceholder.value) {
    return true
  }
  return false
})
const overlayText = computed(() => {
  if (isLoading.value) {
    return t('demoDepth.status.loading')
  }
  if (statusMessage.value.length > 0) {
    return statusMessage.value
  }
  return t('demoDepth.status.waiting')
})

const focusBoxStyle = computed<Record<string, string> | null>(() => {
  const focusBox = props.focusBox
  if (!focusBox) {
    return null
  }
  const left = Math.max(0, Math.min(1, focusBox.left))
  const top = Math.max(0, Math.min(1, focusBox.top))
  const right = Math.max(0, Math.min(1, focusBox.left + focusBox.width))
  const bottom = Math.max(0, Math.min(1, focusBox.top + focusBox.height))
  const width = right - left
  const height = bottom - top
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return {
    left: `${(left * 100).toFixed(4)}%`,
    top: `${(top * 100).toFixed(4)}%`,
    width: `${(width * 100).toFixed(4)}%`,
    height: `${(height * 100).toFixed(4)}%`,
  }
})

const revealMaskStyle = computed<Record<string, string> | undefined>(() => {
  if (!hasPlaceholder.value) {
    return
  }
  const rawProgress = isReady.value ? revealProgress.value : 0
  const clamped = Math.min(1, Math.max(0, rawProgress))
  if (clamped <= 0) {
    const emptyMask = 'linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%)'
    return {
      maskImage: emptyMask,
      WebkitMaskImage: emptyMask,
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskSize: '100% 100%',
      WebkitMaskSize: '100% 100%',
    }
  }
  const eased = clamped * clamped * (3 - 2 * clamped)
  const visible = (eased * 100).toFixed(3)
  const feather = 64
  const mid = Math.min(100, Number(visible) + feather * 0.5).toFixed(3)
  const fade = Math.min(100, Number(visible) + feather).toFixed(3)
  const mask = `linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${visible}%, rgba(0,0,0,0.35) ${mid}%, rgba(0,0,0,0) ${fade}%, rgba(0,0,0,0) 100%)`
  return {
    maskImage: mask,
    WebkitMaskImage: mask,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
  }
})

let three: ThreeModule | null = null
let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: OrthographicCamera | null = null
let mesh: Mesh | null = null
let material: ShaderMaterial | null = null
let uniforms: DepthUniforms | null = null
let activeImageTexture: Texture | null = null
let activeDepthTexture: Texture | null = null
let animationFrame: number | null = null
let revealAnimationFrame: number | null = null
let revealDelayTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
let loadToken = 0

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2 uResolution;

uniform float uDirectionProgress;
uniform float uDepthProgress;

uniform float uMaxBlur;          // Max blur radius in pixels.
uniform float uBlurEasePower;
uniform float uDirectionalDelay;
uniform float uDepthDelay;
uniform float uDepthCurvePower;

uniform float uDirectionMode;    // 0 bottom-up, 1 top-down, 2 left-right, 3 right-left
uniform float uInvertDepth;      // 0 / 1
uniform float uUseDepth;         // 0 / 1

/* ---------------- depth ---------------- */

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float sampleDepth(vec2 uv) {
  float d = texture2D(uDepth, uv).r;
  if (uInvertDepth > 0.5) {
    d = 1.0 - d;
  }
  return clamp(d, 0.0, 1.0);
}

float easePow(float value, float power) {
  float t = clamp(value, 0.0, 1.0);
  float p = max(0.01, power);
  return pow(t, p);
}

float easeInOutPow(float value, float power) {
  float t = clamp(value, 0.0, 1.0);
  float p = max(0.01, power);
  if (t < 0.5) {
    return 0.5 * pow(2.0 * t, p);
  }
  return 1.0 - 0.5 * pow(2.0 * (1.0 - t), p);
}

float easeSignedPow(float value, float power) {
  float t = clamp(value, 0.0, 1.0);
  float p = abs(power);
  if (p < 0.01) {
    return t;
  }
  if (power >= 0.0) {
    return pow(t, p);
  }
  return 1.0 - pow(1.0 - t, p);
}

float smoothMin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

  /* ---------------- blur ---------------- */
  /*
    radiusPixels: blur radius in pixels.
    Poisson disk samples with a subtle hexagonal aperture bias.
  */
  vec4 blurSample(vec2 uv, float radiusPixels) {
    if (radiusPixels <= 0.5) {
      return texture2D(uImage, uv);
    }

    vec2 texel = 1.0 / uResolution;
    float rotation = hash12(uv * uResolution) * 6.2831853;
    float ca = cos(rotation);
    float sa = sin(rotation);
    const int SAMPLES = 24;
    const vec2 OFFSETS[24] = vec2[](
      vec2(-0.326, -0.406),
      vec2(-0.840, -0.074),
      vec2(-0.696, 0.457),
      vec2(-0.203, 0.621),
      vec2(0.962, -0.195),
      vec2(0.473, -0.480),
      vec2(0.519, 0.767),
      vec2(0.185, -0.893),
      vec2(0.507, 0.064),
      vec2(0.896, 0.412),
      vec2(-0.322, -0.933),
      vec2(-0.792, -0.597),
      vec2(-0.189, 0.284),
      vec2(0.050, 0.376),
      vec2(0.456, -0.032),
      vec2(-0.100, -0.120),
      vec2(0.315, -0.731),
      vec2(-0.557, 0.823),
      vec2(0.104, -0.987),
      vec2(-0.937, 0.239),
      vec2(0.740, 0.673),
      vec2(-0.473, -0.174),
      vec2(0.281, 0.959),
      vec2(-0.012, -0.802)
    );

    vec4 color = texture2D(uImage, uv);
    float total = 1.0;
    for (int i = 0; i < SAMPLES; i++) {
      vec2 baseOffset = OFFSETS[i];
      float r = length(baseOffset);
      float sampleAngle = atan(baseOffset.y, baseOffset.x);
      float aperture = 0.97 + 0.03 * cos(6.0 * sampleAngle);
      vec2 rotated = vec2(
        baseOffset.x * ca - baseOffset.y * sa,
        baseOffset.x * sa + baseOffset.y * ca
      );
      float jitter = mix(0.92, 1.08, hash12(uv * uResolution + float(i) * 19.17));
      vec2 offset = rotated * jitter * aperture * radiusPixels * texel;
      vec4 sampleColor = texture2D(uImage, uv + offset);
      float lum = dot(sampleColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      float highlight = smoothstep(0.78, 1.0, lum);
      float falloff = exp(-1.8 * r * r);
      float weight = falloff * (1.0 + highlight * 0.45);
      color += sampleColor * weight;
      total += weight;
    }
    return color / total;
  }

/* ---------------- main ---------------- */

void main() {
  float depth = uUseDepth > 0.5 ? sampleDepth(vUv) : 0.0;

  float sweep = vUv.y;
  if (uDirectionMode > 0.5 && uDirectionMode < 1.5) {
    sweep = 1.0 - vUv.y;          // top-down
  } else if (uDirectionMode >= 1.5 && uDirectionMode < 2.5) {
    sweep = vUv.x;                // left-right
  } else if (uDirectionMode >= 2.5) {
    sweep = 1.0 - vUv.x;          // right-left
  }

  float directionDenom = max(0.001, 1.0 - uDirectionalDelay);
  float depthDenom     = max(0.001, 1.0 - uDepthDelay);

  float directionProgress =
    clamp((uDirectionProgress - sweep * uDirectionalDelay) / directionDenom, 0.0, 1.0);

  float depthProgress = 1.0;
  if (uUseDepth > 0.5) {
    float depthCurve = easeInOutPow(depth, uDepthCurvePower);
    depthProgress =
      clamp((uDepthProgress - depthCurve * uDepthDelay) / depthDenom, 0.0, 1.0);
  }

  float localProgress = smoothMin(directionProgress, depthProgress, 0.18);

  /* ---------- blur radius ---------- */
  float maxDim = max(uResolution.x, uResolution.y);

  float easedProgress = easeSignedPow(localProgress, uBlurEasePower);
  float radiusPixels = (1.0 - easedProgress) * uMaxBlur;

  radiusPixels = clamp(radiusPixels, 0.0, maxDim * 0.5);

  /* ---------- sample ---------- */
  vec4 color = blurSample(vUv, radiusPixels);

  gl_FragColor = color;

  #include <colorspace_fragment>
}
`

function updateMeshScale(): void {
  const host = wrapperRef.value ?? canvasHost.value
  if (!mesh || !host) {
    return
  }
  const { width, height } = host.getBoundingClientRect()
  if (width <= 0 || height <= 0) {
    return
  }
  const containerAspect = width / height
  const imageAspect = displayAspectRatio.value
  let scaleX = 1
  let scaleY = 1
  if (imageAspect > containerAspect) {
    scaleY = containerAspect / imageAspect
  }
  else {
    scaleX = imageAspect / containerAspect
  }
  mesh.scale.set(scaleX, scaleY, 1)
}

function renderScene(): void {
  if (!renderer || !scene || !camera) {
    return
  }
  renderer.render(scene, camera)
}

async function loadTexture(url: string, mode: 'image' | 'depth'): Promise<Texture> {
  const threeModule = three
  if (!threeModule) {
    throw new Error('Three.js is not ready.')
  }
  const loader = new threeModule.TextureLoader()
  return await new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture: Texture) => {
        texture.generateMipmaps = false
        texture.minFilter = threeModule.LinearFilter
        texture.magFilter = threeModule.LinearFilter
        if (mode === 'image') {
          texture.colorSpace = threeModule.SRGBColorSpace
        }
        resolve(texture)
      },
      undefined,
      () => reject(new Error(t('demoDepth.errors.loadFailed'))),
    )
  })
}

function stopReveal(): void {
  if (revealAnimationFrame !== null) {
    cancelAnimationFrame(revealAnimationFrame)
    revealAnimationFrame = null
  }
  isRevealing.value = false
}

function stopRevealDelay(): void {
  if (revealDelayTimer !== null) {
    clearTimeout(revealDelayTimer)
    revealDelayTimer = null
  }
}

function startReveal(token: number): Promise<void> {
  stopReveal()
  revealProgress.value = 0
  if (!hasPlaceholder.value) {
    revealProgress.value = 1
    return Promise.resolve()
  }
  const duration = Math.max(200, props.revealDurationMs)
  const start = performance.now()
  isRevealing.value = true
  return new Promise((resolve) => {
    const tick = (time: number): void => {
      if (token !== loadToken) {
        stopReveal()
        resolve()
        return
      }
      const elapsed = time - start
      const progress = Math.min(1, elapsed / duration)
      revealProgress.value = progress
      if (progress < 1) {
        revealAnimationFrame = requestAnimationFrame(tick)
      }
      else {
        isRevealing.value = false
        revealAnimationFrame = null
        resolve()
      }
    }
    revealAnimationFrame = requestAnimationFrame(tick)
  })
}

function scheduleAutoPlay(token: number): void {
  if (!props.autoPlay) {
    return
  }
  if (!canRender.value || !isReady.value) {
    return
  }
  if (isAnimating.value || isRevealing.value || showFinalImage.value) {
    return
  }
  void startReveal(token)
  stopRevealDelay()
  const delay = Math.max(0, Math.round(props.revealDurationMs * 0.25))
  revealDelayTimer = setTimeout(() => {
    if (token !== loadToken) {
      return
    }
    playAnimation()
  }, delay)
}

function createFallbackDepthTexture(threeModule: ThreeModule): Texture {
  const data = new Uint8Array([128])
  const texture = new threeModule.DataTexture(
    data,
    1,
    1,
    threeModule.RedFormat,
    threeModule.UnsignedByteType,
  )
  texture.generateMipmaps = false
  texture.minFilter = threeModule.LinearFilter
  texture.magFilter = threeModule.LinearFilter
  texture.needsUpdate = true
  return texture
}

function applyTextures(imageTexture: Texture, depthTexture: Texture): void {
  if (!material || !uniforms) {
    return
  }
  const targetUniforms = uniforms
  if (activeImageTexture) {
    activeImageTexture.dispose()
  }
  if (activeDepthTexture) {
    activeDepthTexture.dispose()
  }
  activeImageTexture = imageTexture
  activeDepthTexture = depthTexture
  targetUniforms.uImage.value = imageTexture
  targetUniforms.uDepth.value = depthTexture
  const image = imageTexture.image as { width?: number, height?: number } | null | undefined
  imageSize = {
    width: image?.width ?? 1,
    height: image?.height ?? 1,
  }
  targetUniforms.uResolution.value.set(imageSize.width, imageSize.height)
  updateMeshScale()
  renderScene()
}

async function loadTextures(): Promise<void> {
  const threeModule = three
  if (!threeModule || !material || !uniforms || !canRender.value) {
    return
  }
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
  stopReveal()
  stopRevealDelay()
  isAnimating.value = false
  isReady.value = false
  showFinalImage.value = false
  const targetUniforms = uniforms
  const token = ++loadToken
  isLoading.value = true
  statusMessage.value = ''
  try {
    const imageTexture = await loadTexture(imageUrl.value, 'image')
    const depthTexture = hasDepth.value
      ? await loadTexture(depthUrl.value, 'depth')
      : createFallbackDepthTexture(threeModule)
    if (token !== loadToken) {
      imageTexture.dispose()
      depthTexture.dispose()
      return
    }
    applyTextures(imageTexture, depthTexture)
    targetUniforms.uDirectionProgress.value = 0
    targetUniforms.uDepthProgress.value = 0
    targetUniforms.uUseDepth.value = hasDepth.value ? 1 : 0
    isReady.value = true
    statusMessage.value = ''
    scheduleAutoPlay(token)
  }
  catch (error) {
    statusMessage.value = error instanceof Error ? error.message : t('demoDepth.errors.loadFailed')
  }
  finally {
    isLoading.value = false
  }
}

function updateUniforms(): void {
  if (!material || !uniforms) {
    return
  }
  const targetUniforms = uniforms
  const maxTotalDelay = 0.9
  const useDepth = hasDepth.value
  const totalDelay = useDepth ? props.directionalDelay + props.depthDelay : props.directionalDelay
  const scale = totalDelay > maxTotalDelay ? maxTotalDelay / totalDelay : 1
  let modeValue = 0
  switch (props.directionMode) {
    case 'top-down': {
      modeValue = 1
      break
    }
    case 'left-right': {
      modeValue = 2
      break
    }
    case 'right-left': {
      modeValue = 3
      break
    }
    default: {
      modeValue = 0
      break
    }
  }
  targetUniforms.uMaxBlur.value = effectiveMaxBlur.value
  targetUniforms.uBlurEasePower.value = Number.isFinite(props.blurEasePower) ? props.blurEasePower : -1.6
  targetUniforms.uDirectionalDelay.value = props.directionalDelay * scale
  targetUniforms.uDepthDelay.value = useDepth ? props.depthDelay * scale : 0
  targetUniforms.uDepthCurvePower.value = Number.isFinite(props.depthEasePower) ? Math.max(0.01, props.depthEasePower) : 1
  targetUniforms.uDirectionMode.value = modeValue
  targetUniforms.uInvertDepth.value = props.invertDepth ? 0 : 1
  targetUniforms.uUseDepth.value = useDepth ? 1 : 0
  renderScene()
}

function playAnimation(): void {
  if (!material || !uniforms || !activeImageTexture || !activeDepthTexture) {
    return
  }
  const targetUniforms = uniforms
  const useDepth = hasDepth.value
  showFinalImage.value = false
  stopRevealDelay()
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
  isAnimating.value = true
  const durationDirection = Math.max(0.2, props.directionDurationSeconds) * 1000
  const durationDepth = Math.max(0.2, props.depthDurationSeconds) * 1000
  const start = performance.now()

  const tick = (time: number): void => {
    const elapsed = time - start
    const directionValue = Math.min(1, elapsed / durationDirection)
    const depthValue = useDepth ? Math.min(1, elapsed / durationDepth) : 1
    const easedDirection = directionValue * (2 - directionValue)
    const easedDepth = depthValue * (2 - depthValue)
    targetUniforms.uDirectionProgress.value = easedDirection
    targetUniforms.uDepthProgress.value = easedDepth
    renderScene()
    if (directionValue < 1 || depthValue < 1) {
      animationFrame = requestAnimationFrame(tick)
    }
    else {
      isAnimating.value = false
      animationFrame = null
      showFinalImage.value = true
    }
  }
  animationFrame = requestAnimationFrame(tick)
}

function initThree(): void {
  const threeModule = three
  if (!threeModule || !canvasHost.value) {
    return
  }
  const host = wrapperRef.value ?? canvasHost.value
  const { width, height } = host.getBoundingClientRect()
  containerWidth.value = width
  renderer = new threeModule.WebGLRenderer({ antialias: true, alpha: true })
  renderer.outputColorSpace = threeModule.SRGBColorSpace
  renderer.toneMapping = threeModule.NoToneMapping
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  canvasHost.value.append(renderer.domElement)

  scene = new threeModule.Scene()
  camera = new threeModule.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  camera.position.z = 1

  const geometry = new threeModule.PlaneGeometry(2, 2)
  uniforms = {
    uImage: { value: null },
    uDepth: { value: null },
    uResolution: { value: new threeModule.Vector2(1, 1) },
    uDirectionProgress: { value: 0 },
    uDepthProgress: { value: 0 },
    uMaxBlur: { value: effectiveMaxBlur.value },
    uBlurEasePower: { value: Number.isFinite(props.blurEasePower) ? props.blurEasePower : -1.6 },
    uDirectionalDelay: { value: props.directionalDelay },
    uDepthDelay: { value: props.depthDelay },
    uDepthCurvePower: { value: Number.isFinite(props.depthEasePower) ? Math.max(0.01, props.depthEasePower) : 1 },
    uDirectionMode: { value: 0 },
    uInvertDepth: { value: props.invertDepth ? 0 : 1 },
    uUseDepth: { value: 0 },
  }
  material = new threeModule.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  })

  mesh = new threeModule.Mesh(geometry, material)
  scene.add(mesh)
  updateMeshScale()
  renderScene()

  resizeObserver = new ResizeObserver(() => {
    if (!renderer) {
      return
    }
    const resizeHost = wrapperRef.value ?? canvasHost.value
    if (!resizeHost) {
      return
    }
    const { width: nextWidth, height: nextHeight } = resizeHost.getBoundingClientRect()
    containerWidth.value = nextWidth
    renderer.setSize(nextWidth, nextHeight, false)
    updateMeshScale()
    updateUniforms()
    renderScene()
  })
  if (wrapperRef.value) {
    resizeObserver.observe(wrapperRef.value)
  }
  else {
    resizeObserver.observe(canvasHost.value)
  }
}

defineExpose({
  play: playAnimation,
  isReady,
  isLoading,
  isAnimating,
  isRevealing,
  showFinalImage,
})

onMounted(async () => {
  if (!import.meta.client) {
    return
  }
  three = await import('three')
  initThree()
  if (canRender.value) {
    void loadTextures()
  }
})

onBeforeUnmount(() => {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
  }
  stopReveal()
  stopRevealDelay()
  resizeObserver?.disconnect()
  if (renderer && canvasHost.value?.contains(renderer.domElement)) {
    renderer.domElement.remove()
  }
  renderer?.dispose()
  activeImageTexture?.dispose()
  activeDepthTexture?.dispose()
  material?.dispose()
  mesh?.geometry.dispose()
})

watch([imageUrl, depthUrl], () => {
  if (!canRender.value) {
    isReady.value = false
    return
  }
  void loadTextures()
})

watch(
  () => [
    effectiveMaxBlur.value,
    props.blurEasePower,
    props.directionalDelay,
    props.depthDelay,
    props.depthEasePower,
    props.directionMode,
    props.invertDepth,
    hasDepth.value,
  ],
  () => {
    updateUniforms()
  },
)

watch(
  () => props.autoPlay,
  (next) => {
    if (!next) {
      return
    }
    scheduleAutoPlay(loadToken)
  },
)

watch(
  () => [props.imageWidth, props.imageHeight],
  () => {
    updateMeshScale()
    renderScene()
  },
)
</script>

<template>
  <div ref="wrapperRef" class="relative overflow-hidden rounded-lg bg-default/60" :style="wrapperStyle">
    <div
      v-if="hasPlaceholder"
      class="absolute inset-0 z-0 flex items-center justify-center"
    >
      <img
        :src="placeholderUrl"
        class="pointer-events-none h-full w-full select-none object-fill"
        alt=""
        aria-hidden="true"
      >
    </div>
    <div
      :class="hasPlaceholder ? 'absolute inset-0 z-10' : 'relative z-10'"
      :style="revealMaskStyle"
    >
      <div ref="canvasHost" :class="hasPlaceholder ? 'h-full w-full' : 'w-full'" />
    </div>
    <img
      v-if="showFinalImage"
      :src="imageUrl"
      class="pointer-events-none absolute inset-0 z-20 h-full w-full select-none object-contain"
      alt=""
      aria-hidden="true"
    >
    <div
      v-if="showOverlay"
      class="absolute inset-0 z-30 flex items-center justify-center text-sm text-muted"
    >
      {{ overlayText }}
    </div>
    <div v-if="focusBoxStyle" class="pointer-events-none absolute inset-0 z-40">
      <div
        class="absolute rounded-[2px] border-2 border-green-500"
        :style="focusBoxStyle"
      />
    </div>
  </div>
</template>
