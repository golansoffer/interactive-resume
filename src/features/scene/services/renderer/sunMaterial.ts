import { AdditiveBlending, ShaderMaterial, Vector3 } from 'three';

// Billboarded radial-gradient quad. Position is treated as a 2D position
// inside the quad; the fragment computes radius from center to draw the
// disk. The same shader serves corona (sharp falloff, high peak) and halo
// (soft falloff, low peak) via uniforms.
const VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColorCore;
uniform vec3 uColorRim;
uniform float uFalloff;
uniform float uPeakOpacity;
uniform float uOpacityScale;

varying vec2 vUv;

void main() {
  // 0 at center, 1 at the corner of the quad. We clamp to a unit disk so
  // the quad's corners don't show — anything beyond r=1 is transparent.
  float r = clamp(length(vUv - vec2(0.5)) * 2.0, 0.0, 1.0);

  // Falloff curve: pow(1 - r, uFalloff) — high exponent = sharp edge,
  // low exponent = soft soft halo.
  float intensity = pow(1.0 - r, uFalloff);

  // Color tween from core to rim with radius.
  vec3 color = mix(uColorCore, uColorRim, r);

  float alpha = intensity * uPeakOpacity * uOpacityScale;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

// Inner corona — bright, sharp-edged disk.
export const createSunCoronaMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uColorCore: { value: new Vector3(1.0, 0.91, 0.69) }, // #ffe9b0
      uColorRim:  { value: new Vector3(1.0, 0.81, 0.45) }, // #ffcf72
      uFalloff:   { value: 2.4 },
      uPeakOpacity: { value: 1.0 },
      uOpacityScale: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });

// Outer halo — soft, wide, low-opacity glow.
export const createSunHaloMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uColorCore: { value: new Vector3(1.0, 0.81, 0.45) }, // #ffcf72
      uColorRim:  { value: new Vector3(1.0, 0.6, 0.23) },  // #ff9a3a (lower B than corona rim)
      uFalloff:   { value: 1.6 },
      uPeakOpacity: { value: 0.25 },
      uOpacityScale: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
