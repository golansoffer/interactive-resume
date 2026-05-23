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

// Typed handle returned by the corona/halo factories. The factory captures
// the uOpacityScale uniform reference at construction time and exposes a
// strongly-typed setter — no by-name uniform lookup at the call site, no
// `IUniform | undefined` observable beyond the parse boundary below.
export type SunBillboardMaterial = {
  readonly material: ShaderMaterial;
  readonly setOpacityScale: (value: number) => void;
};

// Builds the shared sun-billboard material, captures the uOpacityScale
// uniform reference, and returns the typed handle. The uniform-lookup
// narrow happens ONCE at construction (parse-boundary check — if it fires,
// the ShaderMaterial config above diverged from the uniform name, which is
// a programming error in this file, not a runtime case).
const buildBillboardMaterial = (
  uniforms: Record<string, { value: unknown }>,
): SunBillboardMaterial => {
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const uniform = material.uniforms['uOpacityScale'];
  if (uniform === undefined) {
    throw new Error(
      'sunMaterial: uOpacityScale uniform missing — shader and uniform definitions are out of sync',
    );
  }
  return {
    material,
    setOpacityScale: (value) => {
      uniform.value = value;
    },
  };
};

// Inner corona — bright, sharp-edged disk.
export const createSunCoronaMaterial = (): SunBillboardMaterial =>
  buildBillboardMaterial({
    uColorCore: { value: new Vector3(1.0, 0.91, 0.69) },
    uColorRim: { value: new Vector3(1.0, 0.81, 0.45) },
    uFalloff: { value: 2.4 },
    uPeakOpacity: { value: 1.0 },
    uOpacityScale: { value: 1.0 },
  });

// Outer halo — soft, wide, low-opacity glow.
export const createSunHaloMaterial = (): SunBillboardMaterial =>
  buildBillboardMaterial({
    uColorCore: { value: new Vector3(1.0, 0.81, 0.45) },
    // Lower blue than corona rim — halo is warmer/oranger so the outer
    // glow reads as a separate band, not a continuation of the corona.
    uColorRim: { value: new Vector3(1.0, 0.6, 0.23) },
    uFalloff: { value: 1.4 },
    uPeakOpacity: { value: 0.7 },
    uOpacityScale: { value: 1.0 },
  });
