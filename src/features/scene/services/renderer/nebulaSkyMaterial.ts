import { BackSide, ShaderMaterial, Vector3 } from 'three';
import type { NebulaPalette } from './deepSpacePalette';

const VERTEX_SHADER = `
varying vec3 vWorldDir;

void main() {
  vWorldDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// 4-octave 3D fbm sampled along the view direction. Two thresholded
// gradients select between base/accent/highlight palette colors. uTime
// scrolls the noise field along one axis at ~0.05 units/sec so the gas
// breathes without ever looping visibly. A subtle vertical brightening
// gives the sky a top/bottom orientation, mimicking a faint horizon.
const FRAGMENT_SHADER = `
uniform float uTime;
uniform float uIntensity;
uniform vec3 uBaseColor;
uniform vec3 uAccentColor;
uniform vec3 uHighlightColor;
varying vec3 vWorldDir;

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  vec3 p = dir * 2.5 + vec3(uTime * 0.05, 0.0, 0.0);
  float n = fbm(p);
  float m = fbm(p * 2.0 + vec3(5.0));

  vec3 col = mix(uBaseColor, uAccentColor, smoothstep(0.35, 0.65, n));
  col = mix(col, uHighlightColor, smoothstep(0.65, 0.85, m) * 0.5);

  float depthFade = smoothstep(-0.5, 0.5, dir.y);
  col *= mix(0.85, 1.10, depthFade);

  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

export const createNebulaSkyMaterial = (palette: NebulaPalette): ShaderMaterial => {
  const [br, bg, bb] = palette.base;
  const [ar, ag, ab] = palette.accent;
  const [hr, hg, hb] = palette.highlight;
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uBaseColor: { value: new Vector3(br, bg, bb) },
      uAccentColor: { value: new Vector3(ar, ag, ab) },
      uHighlightColor: { value: new Vector3(hr, hg, hb) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
  });
};
