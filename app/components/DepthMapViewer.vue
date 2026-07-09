<script setup lang="ts">
import type {
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
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

interface UniformValue<T> { value: T }
interface ComposeUniforms extends Record<string, UniformValue<unknown>> {
  uImage: UniformValue<Texture | null>
  uDepth: UniformValue<Texture | null>
  uFeedback: UniformValue<Texture | null>
  uFrameCount: UniformValue<number>
  uFadeProgress: UniformValue<number>
  uBlurFactor: UniformValue<number>
  uDelta: UniformValue<number>
  uCanvasAspect: UniformValue<number>
  uRectMin: UniformValue<Vector2>
  uRectSize: UniformValue<Vector2>
  uDirectionalDelay: UniformValue<number>
  uDepthDelay: UniformValue<number>
  uDepthCurvePower: UniformValue<number>
  uDepthDetail: UniformValue<number>
  uDirectionMode: UniformValue<number>
  uInvertDepth: UniformValue<number>
  uUseDepth: UniformValue<number>
  uBlurEasePower: UniformValue<number>
}
interface DisplayUniforms extends Record<string, UniformValue<unknown>> {
  uFeedback: UniformValue<Texture | null>
  uDepth: UniformValue<Texture | null>
  uFadeProgress: UniformValue<number>
  uBlurFactor: UniformValue<number>
  uMaxRadius: UniformValue<number>
  uGrain: UniformValue<number>
  uCanvasAspect: UniformValue<number>
  uRectMin: UniformValue<Vector2>
  uRectSize: UniformValue<Vector2>
  uDirectionalDelay: UniformValue<number>
  uDepthDelay: UniformValue<number>
  uDepthCurvePower: UniformValue<number>
  uDepthDetail: UniformValue<number>
  uDirectionMode: UniformValue<number>
  uInvertDepth: UniformValue<number>
  uUseDepth: UniformValue<number>
  uBlurEasePower: UniformValue<number>
}

interface PingPong {
  read: WebGLRenderTarget
  write: WebGLRenderTarget
  swap: () => void
  setSize: (width: number, height: number) => boolean
  dispose: () => void
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
  transitionBlurSeconds?: number
  maxBlur?: number
  blurEasePower?: number
  directionalDelay?: number
  depthDelay?: number
  depthEasePower?: number
  depthDetail?: number
  grain?: number
  directionMode?: DirectionMode
  invertDepth?: boolean
  autoPlay?: boolean
  /** Loading/waiting text. Errors surface regardless. */
  showStatusOverlay?: boolean
  focusBox?: FocusBox | null
}>(), {
  depthUrl: '',
  placeholderUrl: '',
  revealDurationMs: 600,
  directionDurationSeconds: 0,
  depthDurationSeconds: 2,
  transitionBlurSeconds: 0.4,
  blurEasePower: 1,
  directionalDelay: 0.1,
  depthDelay: 0.4,
  depthEasePower: 1.2,
  depthDetail: 1,
  grain: 0.03,
  directionMode: 'bottom-up',
  invertDepth: false,
  autoPlay: true,
  showStatusOverlay: true,
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
const revealSeconds = computed(() => Math.max(
  0.2,
  props.depthDurationSeconds,
  props.directionDurationSeconds,
))
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
  if (!props.showStatusOverlay) {
    return false
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
let displayMaterial: ShaderMaterial | null = null
let displayUniforms: DisplayUniforms | null = null
let composeScene: Scene | null = null
let composeMesh: Mesh | null = null
let composeMaterial: ShaderMaterial | null = null
let copyScene: Scene | null = null
let copyMesh: Mesh | null = null
let copyMaterial: ShaderMaterial | null = null
let copyUniforms: { uTexture: UniformValue<Texture | null> } | null = null
let composeUniforms: ComposeUniforms | null = null
let feedback: PingPong | null = null
let activeImageTexture: Texture | null = null
let activeDepthTexture: Texture | null = null
let revealAnimationFrame: number | null = null
let resizeObserver: ResizeObserver | null = null
let loadToken = 0
let meshScaleX = 1
let meshScaleY = 1

/**
 * The feedback buffer accumulates each frame's blur on top of the previous
 * frame's result, so the per-frame radius is deliberately tiny — the effective
 * radius grows exponentially across frames.
 */
const COMPOSE_RADIUS = 0.005
const DEFAULT_DISPLAY_RADIUS = 0.04
/** Frames the compose pass writes the source image straight through to prime both buffers. */
const BAKE_FRAMES = 3
/**
 * Bake writes a *sharp* image into the feedback buffer, so on first load the
 * compose pass needs a few frames of iterated blur before the reveal begins —
 * otherwise it starts from an almost-sharp frame. Counted in frames rather than
 * milliseconds so a slow device still gets a soft start.
 */
const PRIME_FRAMES = BAKE_FRAMES + 12
const PRIME_TIMEOUT_MS = 500
/** Extra time after the reveal finishes for the exponential mix to converge. */
const SETTLE_MS = 400
const MAX_DELTA = 1 / 30

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fullscreenVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/* Carries the feedback buffer across a resize instead of discarding it. */
const copyFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
void main() {
  gl_FragColor = vec4(texture2D(uTexture, vUv).rgb, 1.0);
}
`

/**
 * Shared between the compose and display passes: both need to know, for a given
 * pixel, *when* it gets revealed (`getOrder`) and *how much* of the reveal has
 * reached it (`getFadeFactor`). They differ only in the progress window they map
 * onto and the blur radius they apply.
 *
 * Two coordinate spaces are in play. The feedback buffer is in *screen* space so
 * that resizing an image never invalidates it; blur radii and feedback lookups
 * use screen uv. Depth, the source image, and the sweep are in *image* space.
 * uRectMin/uRectSize map between them: image = (screen - rectMin) / rectSize.
 */
const shaderCommon = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uDepth;
uniform float uFadeProgress;
uniform float uBlurFactor;
uniform float uCanvasAspect;
uniform vec2 uRectMin;
uniform vec2 uRectSize;

uniform float uDirectionalDelay;
uniform float uDepthDelay;
uniform float uDepthCurvePower;
uniform float uDepthDetail;
uniform float uDirectionMode;
uniform float uInvertDepth;
uniform float uUseDepth;
uniform float uBlurEasePower;

const float TAU = 6.28318530718;
const float GOLDEN_ANGLE = 2.39996323;

/* Outside the letterboxed image rect this clamps, so the blur extends the edge
   colour rather than dragging in transparent pixels. */
vec2 toImageUv(vec2 screenUv) {
  return clamp((screenUv - uRectMin) / uRectSize, 0.0, 1.0);
}

vec2 toScreenUv(vec2 imageUv) {
  return uRectMin + imageUv * uRectSize;
}

float valueRemap(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

/* Low-frequency noise, used to rotate each pixel's sampling disk. Without this
   the Vogel spiral leaves a visible structured pattern at large radii. */
float getNoise(vec2 coord) {
  vec2 p = coord * 0.99;
  float n = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  for (int i = 0; i < 3; i++) {
    n += amplitude * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return n * 0.5 + 0.5;
}

vec2 vogelDisk(int sampleIndex, int sampleCount) {
  float r = sqrt(float(sampleIndex) + 0.5) / sqrt(float(sampleCount));
  float theta = float(sampleIndex) * GOLDEN_ANGLE;
  return vec2(r * cos(theta), r * sin(theta));
}

float gaussian(float x, float sigma) {
  return exp(-(x * x) / (2.0 * sigma * sigma));
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

/* Returns nearness: 1 = closest to camera. MiDaS emits inverse depth, so the
   raw texture is already nearness — uInvertDepth is for maps that are not. */
float sampleNearness(vec2 imageUv) {
  float d = texture2D(uDepth, imageUv).r;
  if (uInvertDepth > 0.5) {
    d = 1.0 - d;
  }
  return clamp(d, 0.0, 1.0);
}

/* Biases the far field by image height so the sweep follows perspective rather
   than the depth map alone — ground planes read as nearer at the bottom.
   Takes and returns nearness. */
float addDepthDetail(float depth, float imageY) {
  float extra = uDepthDetail;
  if (extra <= 0.0) {
    return clamp(depth, 0.0, 1.0);
  }
  float transitionMin = 0.6;
  float d = depth;
  float additional = clamp(valueRemap(d, transitionMin, 0.0, 0.0, 1.0), 0.0, 1.0) * imageY * extra;
  if (d < transitionMin) {
    d -= additional;
  }
  d = valueRemap(d, 1.0, -extra, 1.0, 0.0);
  return clamp(d, 0.0, 1.0);
}

float getSweep(vec2 imageUv) {
  if (uDirectionMode > 0.5 && uDirectionMode < 1.5) {
    return 1.0 - imageUv.y;
  }
  if (uDirectionMode >= 1.5 && uDirectionMode < 2.5) {
    return imageUv.x;
  }
  if (uDirectionMode >= 2.5) {
    return 1.0 - imageUv.x;
  }
  return imageUv.y;
}

/* 0 = revealed first, 1 = revealed last. The two delay props act as weights.
   Near pixels come into focus before far ones, so order tracks farness. */
float getOrder(vec2 imageUv) {
  float depthOrder = 0.0;
  if (uUseDepth > 0.5) {
    float nearness = addDepthDetail(sampleNearness(imageUv), imageUv.y);
    depthOrder = easeInOutPow(1.0 - nearness, uDepthCurvePower);
  }
  float total = uDirectionalDelay + uDepthDelay;
  if (total < 0.0001) {
    return 0.0;
  }
  float delay = getSweep(imageUv) * uDirectionalDelay + depthOrder * uDepthDelay;
  return clamp(delay / total, 0.0, 1.0);
}

/* A soft band of the given amplitude sweeping across the order value, rather
   than a hard threshold. Returns 1 where the pixel is fully revealed. */
float getFadeFactor(float order, float lo, float hi, float amplitude, float midLow) {
  float progress = clamp(valueRemap(uFadeProgress, lo, hi, 0.0, 1.0), 0.0, 1.0);
  float halfAmplitude = amplitude * 0.5;
  float middle = valueRemap(progress, 0.0, 1.0, midLow, 1.0 + halfAmplitude);
  float fade = valueRemap(order, middle - halfAmplitude, middle + halfAmplitude, 1.0, 0.0);
  return easeSignedPow(clamp(fade, 0.0, 1.0), uBlurEasePower);
}

/* Samples in screen uv; the x correction keeps the disk circular on screen. */
vec3 vogelBlur(sampler2D tex, vec2 screenUv, float radius, float sigma, float rotation, int samples) {
  vec3 color = vec3(0.0);
  float cosR = cos(rotation);
  float sinR = sin(rotation);
  float totalWeight = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= samples) {
      break;
    }
    vec2 offset = vogelDisk(i, samples) * radius;
    vec2 rotated = vec2(
      offset.x * cosR - offset.y * sinR,
      offset.x * sinR + offset.y * cosR
    );
    rotated.x /= uCanvasAspect;
    float weight = gaussian(length(rotated), sigma);
    color += texture2D(tex, screenUv + rotated).rgb * weight;
    totalWeight += weight;
  }
  return color / totalWeight;
}
`

/**
 * Pass 1 — writes into the float ping-pong buffer.
 *
 * Unrevealed pixels re-blur the previous frame's output, so the old image
 * dissolves. Only once a pixel is fully revealed does it start absorbing the
 * target colour, at a frame-rate independent exponential rate.
 */
const composeFragmentShader = `
${shaderCommon}

uniform sampler2D uImage;
uniform sampler2D uFeedback;
uniform float uFrameCount;
uniform float uDelta;

const int COMPOSE_SAMPLES = 8;
const float COMPOSE_RADIUS = ${COMPOSE_RADIUS.toFixed(6)};
const float FADE_AMPLITUDE = 0.4;
const float FADE_ENDS_AT = 0.7;
const float MIX_MULTIPLIER = 5.0;

void main() {
  // vUv is screen uv here: this pass fills the whole feedback buffer, including
  // the letterbox, where toImageUv clamps to the image's edge pixels.
  vec2 imageUv = toImageUv(vUv);

  if (uFrameCount < ${BAKE_FRAMES.toFixed(1)}) {
    gl_FragColor = vec4(texture2D(uImage, imageUv).rgb, 1.0);
    return;
  }

  float order = getOrder(imageUv);
  float fade = getFadeFactor(order, 0.0, FADE_ENDS_AT, FADE_AMPLITUDE, 0.0);

  float blurSize = max(1.0 - fade, uBlurFactor);
  if (blurSize > 0.000001) {
    float rotation = getNoise(gl_FragCoord.xy) * TAU;
    float radius = COMPOSE_RADIUS * blurSize;
    vec3 blurred = vogelBlur(uFeedback, vUv, radius, radius * 0.5, rotation, COMPOSE_SAMPLES);
    gl_FragColor = vec4(blurred, 1.0);
    return;
  }

  vec3 previous = texture2D(uFeedback, vUv).rgb;
  vec3 target = texture2D(uImage, imageUv).rgb;
  float mixFactor = clamp(fade * MIX_MULTIPLIER * uDelta, 0.0, 1.0);
  gl_FragColor = vec4(mix(previous, target, mixFactor), 1.0);
}
`

/**
 * Pass 2 — reads the feedback buffer, applies the wide bokeh, presents to canvas.
 *
 * Its progress window is offset against the compose pass ([0.3, 1] vs [0, 0.7]),
 * so colour lands before sharpness does.
 */
const displayFragmentShader = `
${shaderCommon}

uniform sampler2D uFeedback;
uniform float uMaxRadius;
uniform float uGrain;

const int DISPLAY_SAMPLES = 32;
const float FADE_AMPLITUDE = 0.2;
const float FADE_STARTS_AT = 0.3;

void main() {
  // vUv is image uv here: this pass draws the contained quad, not the full canvas.
  vec2 screenUv = toScreenUv(vUv);

  float order = getOrder(vUv);
  float fade = getFadeFactor(order, FADE_STARTS_AT, 1.0, FADE_AMPLITUDE, -FADE_AMPLITUDE * 0.5);

  float blurAmount = max(1.0 - fade, uBlurFactor);
  float noiseFactor = getNoise(gl_FragCoord.xy);
  float radius = uMaxRadius * blurAmount;

  vec3 color;
  if (radius < 0.000001) {
    color = texture2D(uFeedback, screenUv).rgb;
  }
  else {
    color = vogelBlur(uFeedback, screenUv, radius, radius * 0.5, noiseFactor * TAU, DISPLAY_SAMPLES);
  }

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>

  // Grain goes on after the transfer function: in linear space the same offset
  // would blow out the shadows, and negative values would poison the encode.
  // Only where the image is out of focus, so sharp areas stay clean.
  // getNoise sums three octaves, so its range overshoots [0,1] — clamp before
  // treating it as a signed offset or the grain gets ~75% hotter than uGrain.
  float grain = clamp(noiseFactor, 0.0, 1.0) - 0.5;
  gl_FragColor.rgb = clamp(gl_FragColor.rgb + grain * uGrain * blurAmount, 0.0, 1.0);
}
`

/* ---------------- tweens ---------------- */

interface Tween {
  from: number
  to: number
  startedAt: number
  durationMs: number
  apply: (value: number) => void
  resolve: () => void
  token: number
}

let tweens: Tween[] = []

/**
 * cubic-bezier(0, 0, 0.58, 1) — the standard `easeOut`. Deliberately gentler
 * than easeOutCubic: the shader's soft band already carries most of the easing,
 * and stacking two ease-outs collapses the reveal into the first third.
 */
function easeOut(t: number): number {
  if (t <= 0) {
    return 0
  }
  if (t >= 1) {
    return 1
  }
  const x1 = 0
  const x2 = 0.58
  // Solve x(u) = t for u by bisection, then evaluate y(u).
  let low = 0
  let high = 1
  let u = t
  for (let i = 0; i < 20; i++) {
    u = (low + high) / 2
    const inv = 1 - u
    const x = 3 * inv * inv * u * x1 + 3 * inv * u * u * x2 + u * u * u
    if (x < t) {
      low = u
    }
    else {
      high = u
    }
  }
  const inv = 1 - u
  // y1 = 0, y2 = 1
  return 3 * inv * u * u + u * u * u
}

function tween(
  from: number,
  to: number,
  durationMs: number,
  apply: (value: number) => void,
  token: number,
): Promise<void> {
  apply(from)
  if (durationMs <= 0) {
    apply(to)
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    tweens.push({
      from,
      to,
      startedAt: performance.now(),
      durationMs,
      apply,
      resolve,
      token,
    })
  })
}

function stepTweens(now: number): void {
  if (tweens.length === 0) {
    return
  }
  const remaining: Tween[] = []
  for (const item of tweens) {
    if (item.token !== loadToken) {
      item.resolve()
      continue
    }
    const progress = Math.min(1, (now - item.startedAt) / item.durationMs)
    item.apply(item.from + (item.to - item.from) * easeOut(progress))
    if (progress < 1) {
      remaining.push(item)
    }
    else {
      item.resolve()
    }
  }
  tweens = remaining
}

function cancelTweens(): void {
  for (const item of tweens) {
    item.resolve()
  }
  tweens = []
  resolvePrime()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/* ---------------- render loop ---------------- */

let loopFrame: number | null = null
let lastFrameTime = 0
let frameCount = 0

/* Resolves once the compose pass has run `frames` more iterations, or the
   deadline passes. Only meaningful while the render loop is running. */
let primeTarget = 0
let primeDeadline = 0
let primeResolve: (() => void) | null = null

function waitForPrime(frames: number): Promise<void> {
  resolvePrime()
  primeTarget = frameCount + frames
  primeDeadline = performance.now() + PRIME_TIMEOUT_MS
  return new Promise((resolve) => {
    primeResolve = resolve
  })
}

function resolvePrime(): void {
  if (primeResolve) {
    const resolve = primeResolve
    primeResolve = null
    resolve()
  }
}

function stepPrime(now: number): void {
  if (primeResolve && (frameCount >= primeTarget || now >= primeDeadline)) {
    resolvePrime()
  }
}

function renderFrame(delta: number): void {
  if (!renderer || !scene || !camera || !composeScene || !feedback || !composeUniforms || !displayUniforms) {
    return
  }
  composeUniforms.uDelta.value = delta
  composeUniforms.uFrameCount.value = frameCount
  composeUniforms.uFeedback.value = feedback.read.texture

  renderer.setRenderTarget(feedback.write)
  renderer.render(composeScene, camera)
  feedback.swap()
  frameCount += 1

  displayUniforms.uFeedback.value = feedback.read.texture
  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

function loop(now: number): void {
  loopFrame = requestAnimationFrame(loop)
  const delta = lastFrameTime === 0 ? 1 / 60 : Math.min(MAX_DELTA, (now - lastFrameTime) / 1000)
  lastFrameTime = now
  stepTweens(now)
  renderFrame(delta)
  stepPrime(now)
}

function startLoop(): void {
  if (loopFrame !== null) {
    return
  }
  lastFrameTime = 0
  loopFrame = requestAnimationFrame(loop)
}

function stopLoop(): void {
  if (loopFrame !== null) {
    cancelAnimationFrame(loopFrame)
    loopFrame = null
  }
}

/* ---------------- sizing ---------------- */

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
  meshScaleX = 1
  meshScaleY = 1
  if (imageAspect > containerAspect) {
    meshScaleY = containerAspect / imageAspect
  }
  else {
    meshScaleX = imageAspect / containerAspect
  }
  mesh.scale.set(meshScaleX, meshScaleY, 1)
}

/**
 * Where the contained image sits inside the canvas, in screen uv. Cheap, and
 * safe to call mid-animation: it never touches the feedback buffer, so changing
 * the image, its aspect ratio, or any tuning prop cannot interrupt a reveal.
 */
function updateProjection(): void {
  if (!renderer || !composeUniforms || !displayUniforms) {
    return
  }
  const host = wrapperRef.value ?? canvasHost.value
  if (!host) {
    return
  }
  const { width, height } = host.getBoundingClientRect()
  if (width <= 0 || height <= 0) {
    return
  }
  for (const target of [composeUniforms, displayUniforms]) {
    target.uRectMin.value.set((1 - meshScaleX) / 2, (1 - meshScaleY) / 2)
    target.uRectSize.value.set(meshScaleX, meshScaleY)
    target.uCanvasAspect.value = width / height
  }

  // Per-sample radius, not the perceived one: the feedback loop compounds it
  // across frames, so it is several times wider than this by the time it lands.
  const maxBlur = props.maxBlur
  displayUniforms.uMaxRadius.value
    = typeof maxBlur === 'number' && Number.isFinite(maxBlur) && maxBlur > 0
      ? Math.min(0.2, maxBlur / width)
      : DEFAULT_DISPLAY_RADIUS
}

function canvasSize(): { width: number, height: number } | null {
  const host = wrapperRef.value ?? canvasHost.value
  if (!host) {
    return null
  }
  const { width, height } = host.getBoundingClientRect()
  return width > 0 && height > 0 ? { width, height } : null
}

/**
 * The wrapper has no height until an aspect ratio is known, and the canvas takes
 * its height from the wrapper. Creating the feedback buffer before then would
 * size it 1px tall and force a reset — mid-reveal — once the real size lands.
 * So the buffer, and playback, wait for a usable size.
 */
function ensureFeedback(): boolean {
  if (feedback) {
    return true
  }
  if (!three || !renderer || !canvasHost.value) {
    return false
  }
  const size = canvasSize()
  if (!size) {
    return false
  }
  // updateStyle must stay on: the canvas's CSS height is what gives the wrapper
  // its height, and the wrapper's height is what we measure here.
  renderer.setSize(size.width, size.height)
  if (!renderer.domElement.isConnected) {
    renderer.domElement.style.display = 'block'
    canvasHost.value.append(renderer.domElement)
  }
  const pixelRatio = renderer.getPixelRatio()
  feedback = createPingPong(
    three,
    renderer,
    Math.max(1, Math.round(size.width * pixelRatio)),
    Math.max(1, Math.round(size.height * pixelRatio)),
  )
  frameCount = 0
  updateMeshScale()
  updateProjection()
  return true
}

/**
 * Resizing a render target discards its contents, and a bare re-bake would
 * write the *sharp* source image back into the feedback buffer — wiping out a
 * dissolve in progress. Callers resize for reasons that have nothing to do with
 * the animation (a container settling into its final layout, a window resize),
 * so instead we allocate at the new size and blit the old contents across.
 * frameCount is left alone, so the compose pass never re-bakes.
 */
function resizeRenderTargets(): void {
  if (!three || !renderer || !feedback || !camera || !copyScene || !copyUniforms) {
    return
  }
  const size = canvasSize()
  if (!size) {
    return
  }
  const pixelRatio = renderer.getPixelRatio()
  const width = Math.max(1, Math.round(size.width * pixelRatio))
  const height = Math.max(1, Math.round(size.height * pixelRatio))
  if (feedback.read.width === width && feedback.read.height === height) {
    return
  }

  const next = createPingPong(three, renderer, width, height)
  copyUniforms.uTexture.value = feedback.read.texture
  for (const target of [next.read, next.write]) {
    renderer.setRenderTarget(target)
    renderer.render(copyScene, camera)
  }
  renderer.setRenderTarget(null)
  feedback.dispose()
  feedback = next
}

/* ---------------- textures ---------------- */

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
          // Lets the GPU decode to linear on sample; the feedback buffer is linear.
          texture.colorSpace = threeModule.SRGBColorSpace
        }
        resolve(texture)
      },
      undefined,
      () => reject(new Error(t('demoDepth.errors.loadFailed'))),
    )
  })
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
  if (!composeUniforms || !displayUniforms) {
    return
  }
  activeImageTexture?.dispose()
  activeDepthTexture?.dispose()
  activeImageTexture = imageTexture
  activeDepthTexture = depthTexture
  composeUniforms.uImage.value = imageTexture
  composeUniforms.uDepth.value = depthTexture
  displayUniforms.uDepth.value = depthTexture
  const image = imageTexture.image as { width?: number, height?: number } | null | undefined
  imageSize = {
    width: image?.width ?? 1,
    height: image?.height ?? 1,
  }
  updateMeshScale()
  updateProjection()
}

async function loadPair(): Promise<[Texture, Texture]> {
  const threeModule = three
  if (!threeModule) {
    throw new Error('Three.js is not ready.')
  }
  const [imageTexture, depthTexture] = await Promise.all([
    loadTexture(imageUrl.value, 'image'),
    hasDepth.value
      ? loadTexture(depthUrl.value, 'depth')
      : Promise.resolve(createFallbackDepthTexture(threeModule)),
  ])
  return [imageTexture, depthTexture]
}

function setFadeProgress(value: number): void {
  if (composeUniforms) {
    composeUniforms.uFadeProgress.value = value
  }
  if (displayUniforms) {
    displayUniforms.uFadeProgress.value = value
  }
}

function setBlurFactor(value: number): void {
  if (composeUniforms) {
    composeUniforms.uBlurFactor.value = value
  }
  if (displayUniforms) {
    displayUniforms.uBlurFactor.value = value
  }
}

async function runReveal(token: number): Promise<void> {
  isAnimating.value = true
  await tween(0, 1, revealSeconds.value * 1000, setFadeProgress, token)
  if (token !== loadToken) {
    return
  }
  // Let the exponential mix converge before the sharp <img> takes over.
  await sleep(SETTLE_MS)
  if (token !== loadToken) {
    return
  }
  isAnimating.value = false
  showFinalImage.value = true
  stopLoop()
}

/**
 * Blur the whole frame out, swap textures while nothing is legible, then sweep
 * the new image back into focus. Decode happens behind the blur, so there is no
 * pop-in and no stall.
 */
async function runTransition(token: number): Promise<void> {
  showFinalImage.value = false
  if (!ensureFeedback()) {
    return
  }
  isAnimating.value = true
  startLoop()
  // The placeholder may still be covering the canvas if the first load never
  // got to play (e.g. autoPlay was false until the full-size image arrived).
  void startReveal(token)

  const preload = loadPair()
  const blurOut = tween(0, 1, props.transitionBlurSeconds * 1000, setBlurFactor, token)
  const [textures] = await Promise.all([preload, blurOut])
  if (token !== loadToken) {
    textures[0].dispose()
    textures[1].dispose()
    return
  }

  applyTextures(textures[0], textures[1])
  setBlurFactor(0)
  setFadeProgress(0)
  await runReveal(token)
}

async function loadTextures(): Promise<void> {
  if (!three || !composeUniforms || !canRender.value) {
    return
  }
  cancelTweens()
  stopReveal()
  stopRevealDelay()
  isAnimating.value = false
  isReady.value = false
  showFinalImage.value = false

  const token = ++loadToken
  const isFirstLoad = !activeImageTexture
  isLoading.value = true
  statusMessage.value = ''

  try {
    if (isFirstLoad) {
      const [imageTexture, depthTexture] = await loadPair()
      if (token !== loadToken) {
        imageTexture.dispose()
        depthTexture.dispose()
        return
      }
      applyTextures(imageTexture, depthTexture)
      setBlurFactor(0)
      setFadeProgress(0)
      updateUniforms()
      isReady.value = true
      isLoading.value = false
      // If the canvas has no size yet, the ResizeObserver starts playback instead.
      if (ensureFeedback()) {
        frameCount = 0
        startLoop()
        void scheduleAutoPlay(token)
      }
      return
    }

    updateUniforms()
    isReady.value = true
    isLoading.value = false
    await runTransition(token)
  }
  catch (error) {
    statusMessage.value = error instanceof Error ? error.message : t('demoDepth.errors.loadFailed')
  }
  finally {
    isLoading.value = false
  }
}

/* ---------------- reveal mask (placeholder) ---------------- */

function stopReveal(): void {
  if (revealAnimationFrame !== null) {
    cancelAnimationFrame(revealAnimationFrame)
    revealAnimationFrame = null
  }
  isRevealing.value = false
}

/* The reveal no longer waits on a timer, only on primed frames. */
function stopRevealDelay(): void {
  resolvePrime()
}

/**
 * Wipes the placeholder away to expose the canvas. Every path that renders to
 * the canvas must call this, or the mask leaves the canvas invisible and the
 * viewer appears to jump straight from placeholder to final image.
 *
 * Resumes from the current progress rather than restarting, so swapping the
 * image mid-wipe does not snap the placeholder back over the canvas.
 */
function startReveal(token: number): Promise<void> {
  stopReveal()
  if (!hasPlaceholder.value) {
    revealProgress.value = 1
    return Promise.resolve()
  }
  const from = Math.min(1, Math.max(0, revealProgress.value))
  if (from >= 1) {
    return Promise.resolve()
  }
  const duration = Math.max(200, props.revealDurationMs) * (1 - from)
  const start = performance.now()
  isRevealing.value = true
  return new Promise((resolve) => {
    const tick = (time: number): void => {
      if (token !== loadToken) {
        stopReveal()
        resolve()
        return
      }
      const progress = Math.min(1, (time - start) / duration)
      revealProgress.value = from + (1 - from) * progress
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

async function scheduleAutoPlay(token: number): Promise<void> {
  if (!props.autoPlay || !canRender.value || !isReady.value) {
    return
  }
  if (isAnimating.value || isRevealing.value || showFinalImage.value) {
    return
  }
  void startReveal(token)
  stopRevealDelay()
  // Let the compose pass soften the freshly-baked sharp frame first.
  await waitForPrime(PRIME_FRAMES)
  if (token !== loadToken) {
    return
  }
  await runReveal(token)
}

/* ---------------- uniforms ---------------- */

function updateUniforms(): void {
  if (!composeUniforms || !displayUniforms) {
    return
  }
  const useDepth = hasDepth.value
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
  for (const target of [composeUniforms, displayUniforms]) {
    target.uDirectionalDelay.value = props.directionalDelay
    target.uDepthDelay.value = useDepth ? props.depthDelay : 0
    target.uDepthCurvePower.value = Number.isFinite(props.depthEasePower) ? Math.max(0.01, props.depthEasePower) : 1
    target.uDepthDetail.value = Number.isFinite(props.depthDetail) ? Math.max(0, props.depthDetail) : 1
    target.uDirectionMode.value = modeValue
    target.uInvertDepth.value = props.invertDepth ? 1 : 0
    target.uUseDepth.value = useDepth ? 1 : 0
    target.uBlurEasePower.value = Number.isFinite(props.blurEasePower) ? props.blurEasePower : 1
  }
  displayUniforms.uGrain.value = Number.isFinite(props.grain) ? Math.max(0, props.grain) : 0
  updateProjection()
}

function playAnimation(): void {
  if (!activeImageTexture || !activeDepthTexture || !ensureFeedback()) {
    return
  }
  cancelTweens()
  stopRevealDelay()
  showFinalImage.value = false
  startLoop()
  void startReveal(loadToken)
  setBlurFactor(0)
  setFadeProgress(0)
  void runReveal(loadToken)
}

/* ---------------- setup ---------------- */

/**
 * The feedback buffer must be float: each frame only mixes in ~`5 * delta` of the
 * target colour, an increment an 8-bit target would quantise away, and the error
 * compounds into banding.
 */
function createPingPong(threeModule: ThreeModule, target: WebGLRenderer, width: number, height: number): PingPong {
  const gl = target.getContext()
  const canRenderFloat = Boolean(
    gl.getExtension('EXT_color_buffer_float') ?? gl.getExtension('EXT_color_buffer_half_float'),
  )
  const type = canRenderFloat ? threeModule.HalfFloatType : threeModule.UnsignedByteType

  const options = {
    minFilter: threeModule.LinearFilter,
    magFilter: threeModule.LinearFilter,
    format: threeModule.RGBAFormat,
    type,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  }
  const a = new threeModule.WebGLRenderTarget(width, height, options)
  const b = new threeModule.WebGLRenderTarget(width, height, options)
  a.texture.colorSpace = threeModule.LinearSRGBColorSpace
  b.texture.colorSpace = threeModule.LinearSRGBColorSpace

  const state: PingPong = {
    read: a,
    write: b,
    swap() {
      const previous = state.read
      state.read = state.write
      state.write = previous
    },
    setSize(nextWidth: number, nextHeight: number) {
      if (a.width === nextWidth && a.height === nextHeight) {
        return false
      }
      a.setSize(nextWidth, nextHeight)
      b.setSize(nextWidth, nextHeight)
      return true
    },
    dispose() {
      a.dispose()
      b.dispose()
    },
  }
  return state
}

function initThree(): void {
  const threeModule = three
  if (!threeModule || !canvasHost.value) {
    return
  }
  const host = wrapperRef.value ?? canvasHost.value
  containerWidth.value = host.getBoundingClientRect().width

  renderer = new threeModule.WebGLRenderer({ antialias: true, alpha: true })
  renderer.outputColorSpace = threeModule.SRGBColorSpace
  renderer.toneMapping = threeModule.NoToneMapping
  // The feedback loop runs two full-screen passes per frame; 1.5x is the ceiling
  // where that stays cheap on high-DPI displays.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  // The canvas is attached by ensureFeedback, once the wrapper has a height.
  // Attaching a zero-height canvas here would make it prop the wrapper open at
  // 1px, and canvasSize() would accept that as a usable size.

  camera = new threeModule.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  camera.position.z = 1

  composeUniforms = {
    uImage: { value: null },
    uDepth: { value: null },
    uFeedback: { value: null },
    uFrameCount: { value: 0 },
    uFadeProgress: { value: 0 },
    uBlurFactor: { value: 0 },
    uDelta: { value: 1 / 60 },
    uCanvasAspect: { value: 1 },
    uRectMin: { value: new threeModule.Vector2(0, 0) },
    uRectSize: { value: new threeModule.Vector2(1, 1) },
    uDirectionalDelay: { value: props.directionalDelay },
    uDepthDelay: { value: props.depthDelay },
    uDepthCurvePower: { value: 1 },
    uDepthDetail: { value: props.depthDetail },
    uDirectionMode: { value: 0 },
    uInvertDepth: { value: props.invertDepth ? 1 : 0 },
    uUseDepth: { value: 0 },
    uBlurEasePower: { value: props.blurEasePower },
  }
  displayUniforms = {
    uFeedback: { value: null },
    uDepth: { value: null },
    uFadeProgress: { value: 0 },
    uBlurFactor: { value: 0 },
    uMaxRadius: { value: DEFAULT_DISPLAY_RADIUS },
    uGrain: { value: props.grain },
    uCanvasAspect: { value: 1 },
    uRectMin: { value: new threeModule.Vector2(0, 0) },
    uRectSize: { value: new threeModule.Vector2(1, 1) },
    uDirectionalDelay: { value: props.directionalDelay },
    uDepthDelay: { value: props.depthDelay },
    uDepthCurvePower: { value: 1 },
    uDepthDetail: { value: props.depthDetail },
    uDirectionMode: { value: 0 },
    uInvertDepth: { value: props.invertDepth ? 1 : 0 },
    uUseDepth: { value: 0 },
    uBlurEasePower: { value: props.blurEasePower },
  }

  composeScene = new threeModule.Scene()
  composeMaterial = new threeModule.ShaderMaterial({
    uniforms: composeUniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader: composeFragmentShader,
  })
  composeMesh = new threeModule.Mesh(new threeModule.PlaneGeometry(2, 2), composeMaterial)
  composeMesh.frustumCulled = false
  composeScene.add(composeMesh)

  copyScene = new threeModule.Scene()
  copyUniforms = { uTexture: { value: null } }
  copyMaterial = new threeModule.ShaderMaterial({
    uniforms: copyUniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader: copyFragmentShader,
  })
  copyMesh = new threeModule.Mesh(new threeModule.PlaneGeometry(2, 2), copyMaterial)
  copyMesh.frustumCulled = false
  copyScene.add(copyMesh)

  scene = new threeModule.Scene()
  displayMaterial = new threeModule.ShaderMaterial({
    uniforms: displayUniforms,
    vertexShader,
    fragmentShader: displayFragmentShader,
    transparent: true,
  })
  mesh = new threeModule.Mesh(new threeModule.PlaneGeometry(2, 2), displayMaterial)
  scene.add(mesh)

  updateMeshScale()
  ensureFeedback()

  resizeObserver = new ResizeObserver(() => {
    if (!renderer) {
      return
    }
    const size = canvasSize()
    if (!size) {
      return
    }
    containerWidth.value = size.width

    if (!feedback) {
      // First usable size. Build the buffer now, and start the playback that
      // loadTextures deferred because there was nothing to render into.
      if (ensureFeedback() && isReady.value) {
        startLoop()
        void scheduleAutoPlay(loadToken)
      }
      return
    }

    renderer.setSize(size.width, size.height)
    updateMeshScale()
    resizeRenderTargets()
    updateProjection()
  })
  resizeObserver.observe(wrapperRef.value ?? canvasHost.value)
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
  stopLoop()
  cancelTweens()
  stopReveal()
  stopRevealDelay()
  resizeObserver?.disconnect()
  if (renderer && canvasHost.value?.contains(renderer.domElement)) {
    renderer.domElement.remove()
  }
  renderer?.dispose()
  activeImageTexture?.dispose()
  activeDepthTexture?.dispose()
  displayMaterial?.dispose()
  mesh?.geometry.dispose()
  composeMaterial?.dispose()
  composeMesh?.geometry.dispose()
  copyMaterial?.dispose()
  copyMesh?.geometry.dispose()
  feedback?.dispose()
  feedback = null
  composeMesh = null
  composeMaterial = null
  composeScene = null
  copyMesh = null
  copyMaterial = null
  copyScene = null
  copyUniforms = null
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
    props.maxBlur,
    props.blurEasePower,
    props.directionalDelay,
    props.depthDelay,
    props.depthEasePower,
    props.depthDetail,
    props.grain,
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
    void scheduleAutoPlay(loadToken)
  },
)

watch(
  () => [props.imageWidth, props.imageHeight],
  () => {
    updateMeshScale()
    updateProjection()
  },
)
</script>

<template>
  <div ref="wrapperRef" class="depth-viewer-root relative overflow-hidden rounded-none bg-default/60" :style="wrapperStyle">
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
        class="absolute rounded-[2px] border-2 border-focus-point"
        :style="focusBoxStyle"
      />
    </div>
  </div>
</template>

<style scoped>
.depth-viewer-root,
.depth-viewer-root :deep(canvas),
.depth-viewer-root :deep(img) {
  image-rendering: smooth;
  image-rendering: high-quality;
}
</style>
