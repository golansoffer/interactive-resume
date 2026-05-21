import { AdditiveBlending, Color, ShaderMaterial } from 'three';

export type StarfieldMaterialParams = {
  readonly color: string;
};

const DEFAULT_HALO_SIZE_BOOST = 14.0;
const DEFAULT_HALO_STRENGTH = 0.55;
const DEFAULT_SPIKE_STRENGTH = 0.45;

const VERTEX_SHADER = `
attribute float aSize;
attribute float aBrightness;
attribute float aTwinkleAmp;
attribute float aTwinkleSpeed;
attribute float aTwinkleSharp;
attribute float aTwinklePhase;
attribute vec3 aColor;
attribute float aLuminous;

uniform float uTime;
uniform float uPixelRatio;
uniform float uHaloSizeBoost;

varying float vAlpha;
varying vec3 vColor;
varying float vLuminous;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  float wave = sin(uTime * aTwinkleSpeed + aTwinklePhase);
  float normalized = 0.5 + 0.5 * wave;
  float sharpened = pow(normalized, 6.0);
  float shaped = mix(normalized, sharpened, aTwinkleSharp);
  float twinkle = 1.0 - aTwinkleAmp + aTwinkleAmp * shaped;

  vAlpha = aBrightness * twinkle;
  vColor = aColor;
  vLuminous = aLuminous;

  float baseSize = aSize * uPixelRatio;
  gl_PointSize = baseSize + aLuminous * uHaloSizeBoost;
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uHaloStrength;
uniform float uSpikeStrength;

varying float vAlpha;
varying vec3 vColor;
varying float vLuminous;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float r = sqrt(r2);

  float core = smoothstep(0.25, 0.0, r2);

  float haloOuter = smoothstep(0.5, 0.0, r);
  float haloInner = smoothstep(0.0, 0.05, r);
  float halo = uHaloStrength * vLuminous * haloOuter * haloInner;

  float spikeMask = step(0.7, vLuminous);
  float spikeStrength = (vLuminous - 0.7) / 0.3;
  float armX = smoothstep(0.04, 0.0, abs(d.y)) * smoothstep(0.5, 0.0, abs(d.x));
  float armY = smoothstep(0.04, 0.0, abs(d.x)) * smoothstep(0.5, 0.0, abs(d.y));
  float spikeFalloff = smoothstep(0.5, 0.0, r);
  float spike = spikeMask * uSpikeStrength * spikeStrength * max(armX, armY) * spikeFalloff;

  float intensity = core + halo + spike;
  gl_FragColor = vec4(uColor * vColor, vAlpha * intensity);
}
`;

const readDevicePixelRatio = (): number => {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio;
  if (typeof dpr !== 'number' || dpr <= 0) return 1;
  return dpr;
};

export const buildStarfieldMaterial = (params: StarfieldMaterialParams): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(params.color) },
      uPixelRatio: { value: readDevicePixelRatio() },
      uHaloSizeBoost: { value: DEFAULT_HALO_SIZE_BOOST },
      uHaloStrength: { value: DEFAULT_HALO_STRENGTH },
      uSpikeStrength: { value: DEFAULT_SPIKE_STRENGTH },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });
