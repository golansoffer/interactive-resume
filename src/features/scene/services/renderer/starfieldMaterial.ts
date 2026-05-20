import { AdditiveBlending, Color, ShaderMaterial } from 'three';

export type StarfieldMaterialParams = {
  readonly color: string;
  readonly twinkleSpeed: number;
};

const VERTEX_SHADER = `
attribute float aSize;
attribute float aBrightness;
attribute float aTwinkleAmp;
attribute float aTwinklePhase;

uniform float uTime;
uniform float uTwinkleSpeed;
uniform float uPixelRatio;

varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  float pulse = sin(uTime * uTwinkleSpeed + aTwinklePhase);
  float twinkle = 1.0 - aTwinkleAmp + aTwinkleAmp * (0.5 + 0.5 * pulse);

  vAlpha = aBrightness * twinkle;
  gl_PointSize = aSize * uPixelRatio;
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColor;
varying float vAlpha;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float core = smoothstep(0.25, 0.0, r2);
  gl_FragColor = vec4(uColor, vAlpha * core);
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
      uTwinkleSpeed: { value: params.twinkleSpeed },
      uColor: { value: new Color(params.color) },
      uPixelRatio: { value: readDevicePixelRatio() },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });
