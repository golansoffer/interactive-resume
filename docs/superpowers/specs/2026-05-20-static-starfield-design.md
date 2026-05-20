# Static Starfield — Design

**Date:** 2026-05-20
**Scope:** Add a camera-anchored static starfield as the far-distance background of the 3D scene. Most stars are static; a small subset pulses subtly. Single draw call, deterministic, no domain state, no new ports.

---

## Goal

The current scene background is a flat `#04050a` color. Empty space reads as void rather than as space. Add a dense layer of small, faint stars sitting "at infinity" behind every other object, so the scene reads as space without competing with planets, ships, or comets for attention.

Two intents drive every parameter:

1. **Cheap.** Single draw call. Static buffers. All animation lives in the shader, driven by one `uTime` uniform.
2. **Quiet.** Stars must complement, not lead. Brightness, count, and twinkle amplitude are tuned so a casual viewer registers "there are stars" once and then never looks at them again.

## Non-goals

- No nebulae, galaxies, or layered parallax backgrounds.
- No constellations, named stars, or any narrative meaning per star.
- No domain state, no events emitted, no port surface, no URL state.
- No reactivity to scene state (idle/cruising/reveal) — the starfield is constant background chrome.
- No postprocessing, no bloom pass.
- No user-tunable controls. Parameters are fixed at design-time constants.

## Architecture

### Layer placement

Three new files, one edit:

```
features/scene/
├── components/Scene/
│   ├── Starfield.tsx                    NEW — R3F adapter
│   └── Scene.tsx                        EDIT — mount <Starfield />
└── services/renderer/
    ├── starfieldSpec.ts                 NEW — pure: seeded RNG → typed-array buffers
    ├── starfieldSpec.test.ts            NEW
    └── starfieldMaterial.ts             NEW — pure: ShaderMaterial factory
```

This matches the existing pattern in `services/renderer/`: pure callable modules (`planetAtmosphereMaterial.ts`, `integrateMotion.ts`, etc.) consumed by thin R3F adapters in `components/Scene/`.

### Layer responsibilities

| File | Responsibility | Forbidden |
|---|---|---|
| `starfieldSpec.ts` | Given a fixed seed + count, produce typed Float32Arrays for positions, sizes, brightness, twinkle amplitude, twinkle phase. Pure. | React, three.js imports, side effects. |
| `starfieldMaterial.ts` | Given a uniform color, return a configured `THREE.ShaderMaterial`. Pure factory. | React, RNG, geometry. |
| `Starfield.tsx` | Compose: build spec, build geometry from spec, build material, render `<points>`, sync group position to camera each frame, tick `uTime` uniform. | Business logic, domain events, conditional rendering by scene state. |
| `Scene.tsx` | Mount `<Starfield />` as the first child inside the fragment. | Pass props to Starfield (it is self-contained). |

`starfieldSpec.ts` is fully unit-testable — no GL context required.

`Starfield.tsx` is the only file that touches React, three-fiber, or the camera. It is a *services-style* adapter (per the project's "services wrap externalities" rule): wires the pure spec + material into a `<points>` element and binds the per-frame externality (the camera position and elapsed time).

### Universal cross-layer rule check

- `starfieldSpec.ts` knows nothing about three.js. It returns plain `Float32Array`s.
- `starfieldMaterial.ts` knows nothing about geometry or counts. It returns a material configured with uniforms only.
- `Starfield.tsx` knows nothing about RNG or shader source — it imports the spec function and the material factory.
- `Scene.tsx` knows nothing about stars beyond the existence of a `<Starfield />` component.

No layer reaches across.

## Camera anchoring

The starfield must feel infinitely far. Implementation:

- `Starfield.tsx` wraps `<points>` in a `<group ref={groupRef}>`.
- In `useFrame`, `groupRef.current.position.copy(state.camera.position)`.
- Star positions in the geometry sit on a sphere of fixed radius `STAR_RADIUS = 400` (units of world space).
- The active camera has `far = 500` (see `FollowCamera.tsx:233`), so stars sit comfortably inside the frustum with 100 units of margin. No far-plane clipping.
- Effect: stars are always ~400 units from the camera in every direction. No parallax. Classic skybox feel without an actual skybox.

The group's rotation is **not** synced to the camera. Stars sit in world orientation, so as the ship rotates the visible sky rotates correctly — only translation is cancelled.

## Star generation

### `starfieldSpec.ts` shape

Discriminated union for the output (Iron Law 2). Single variant — the spec is total, not partial:

```ts
type StarfieldSpec = {
  readonly kind: 'starfield_spec';
  readonly count: number;
  readonly positions: Float32Array;       // length = count * 3
  readonly sizes: Float32Array;           // length = count
  readonly brightness: Float32Array;      // length = count
  readonly twinkleAmps: Float32Array;     // length = count
  readonly twinklePhases: Float32Array;   // length = count
};

export const buildStarfieldSpec = (params: {
  readonly seed: number;
  readonly count: number;
  readonly radius: number;
}): StarfieldSpec;
```

### Parameters

| Constant | Value | Rationale |
|---|---|---|
| `STAR_SEED` | `0xc0ffee` | Fixed seed → deterministic across reloads, HMR-stable. |
| `STAR_COUNT` | `1500` | Dense enough to fill the dome, light enough that no perceptual crowding. |
| `STAR_RADIUS` | `400` | Inside `far=500` frustum with margin. |
| `STAR_SIZE_MIN` | `0.6` | Tiny stars dominate the field. |
| `STAR_SIZE_MAX` | `2.4` | Few bright stars catch the eye occasionally. |
| `STAR_BRIGHTNESS_MIN` | `0.35` | Faint stars never go fully invisible. |
| `STAR_BRIGHTNESS_MAX` | `1.0` | Brightest stars correlate with largest size. |
| `STAR_COLOR` | `#cfd9ff` | Warm-white with slight blue cast. Complements `#04050a` background; no hue clash with comet trails (`#b8dcff` family). |
| `TWINKLE_FRACTION` | `0.12` | ~12% of stars pulse. The rest are static. |
| `TWINKLE_AMP_MIN` | `0.15` | Quiet pulse — never disappears, never spikes hard. |
| `TWINKLE_AMP_MAX` | `0.35` | Maximum pulse depth for any single star. |
| `TWINKLE_SPEED` | `1.6` rad/s | One full pulse cycle ≈ 3.9 s. Slow enough to feel ambient. |

### Distribution

- **Position:** uniform on the sphere of radius `STAR_RADIUS` via inverse-CDF sampling:
  ```
  theta = 2π · u₁
  phi   = acos(1 − 2 · u₂)
  ```
  This is uniform on the unit sphere, not biased toward the equator like naive `(theta, phi) = (2π·u, π·v)` would be.

- **Size:** log-distributed in `[STAR_SIZE_MIN, STAR_SIZE_MAX]` so most stars are tiny and a few are large. Specifically: `size = mix(min, max, u³)` — cube of uniform pushes mass toward the small end.

- **Brightness:** correlated with size. `brightness = mix(BRIGHTNESS_MIN, BRIGHTNESS_MAX, sizeNormalized)` where `sizeNormalized = (size − min) / (max − min)`. Result: bigger stars are also brighter, which matches real perception of point sources.

- **Twinkle assignment:** independent Bernoulli per star with `p = TWINKLE_FRACTION`. For non-twinkling stars, `twinkleAmp = 0`. For twinkling stars, `twinkleAmp ∈ [TWINKLE_AMP_MIN, TWINKLE_AMP_MAX]` uniform. `twinklePhase ∈ [0, 2π]` uniform — randomizes pulse timing so no two stars pulse in lockstep.

### RNG

Mulberry32 (single-state PRNG, deterministic, ~5 lines):

```ts
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
```

No `Math.random()` anywhere — determinism is required for HMR stability and for tests.

## Material

### `starfieldMaterial.ts` shape

```ts
export const buildStarfieldMaterial = (params: {
  readonly color: string;
  readonly twinkleSpeed: number;
}): THREE.ShaderMaterial;
```

Returns a `ShaderMaterial` configured with:

- `transparent: true`
- `depthWrite: false`
- `depthTest: true` (functionally a no-op because of `renderOrder=-1`, but cheap and forgiving)
- `blending: AdditiveBlending` — subtle glow stacking on the near-black background
- Uniforms: `uTime: { value: 0 }`, `uColor: { value: new Color(params.color) }`, `uTwinkleSpeed: { value: params.twinkleSpeed }`, `uPixelRatio: { value: window.devicePixelRatio }`

### Vertex shader

```glsl
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
```

For static stars (`aTwinkleAmp = 0`), `twinkle` collapses to `1.0`. No branching.

### Fragment shader

```glsl
uniform vec3 uColor;
varying float vAlpha;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float core = smoothstep(0.25, 0.0, r2);
  gl_FragColor = vec4(uColor, vAlpha * core);
}
```

Round, soft-edged points. Square corners discarded.

## Integration

### Edit to `Scene.tsx`

Single edit: import `Starfield`, render it as the first child inside the fragment so it lays down before anything else:

```tsx
return (
  <>
    <color attach="background" args={['#04050a']} />
    <Starfield />
    <ambientLight intensity={0.4} />
    {/* …rest unchanged… */}
  </>
);
```

Combined with `renderOrder = -1` on the points mesh, this guarantees stars draw first. Everything else writes depth on top.

### `Starfield.tsx` shape

```tsx
export const Starfield = (): JSX.Element => {
  const groupRef = useRef<Group | null>(null);

  const spec = useMemo(() => buildStarfieldSpec({
    seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS,
  }), []);

  const material = useMemo(() => buildStarfieldMaterial({
    color: STAR_COLOR, twinkleSpeed: TWINKLE_SPEED,
  }), []);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (group === null) return;
    group.position.copy(state.camera.position);
    material.uniforms.uTime.value += delta;
  });

  return (
    <group ref={groupRef}>
      <points renderOrder={-1}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[spec.positions, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[spec.sizes, 1]} />
          <bufferAttribute attach="attributes-aBrightness" args={[spec.brightness, 1]} />
          <bufferAttribute attach="attributes-aTwinkleAmp" args={[spec.twinkleAmps, 1]} />
          <bufferAttribute attach="attributes-aTwinklePhase" args={[spec.twinklePhases, 1]} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>
    </group>
  );
};
```

The `material` instance is stable across renders (created once in `useMemo`), so the `useFrame` closure can mutate `material.uniforms.uTime.value` directly without a ref hop.

No props, no `useEffect`, no domain logic. The only externality bound is `useFrame`, which is the project-sanctioned bridge to the render loop.

## Performance budget

| Cost | Value |
|---|---|
| Draw calls | 1 |
| Vertices | 1500 |
| Vertex attribute memory | ~30 KB (uploaded once) |
| Per-frame CPU work | 1 `Vector3.copy` + 1 uniform float add |
| Per-frame fragment work | ~28k blended fragments (worst case, 1080p) — ~0.1% of frame area |
| GPU shader complexity | Vertex: ~5 ALU ops. Fragment: 1 dot, 1 smoothstep, 1 mul, 1 discard. |

The asteroid layer (10 GLB meshes + 10 trail strips) is an order of magnitude heavier and already ships. The starfield is meaningfully cheaper than `<Asteroids />`.

## Testing

### Unit tests — `starfieldSpec.test.ts`

- **Determinism:** `buildStarfieldSpec({seed: 1, count: 100, radius: 10})` returns identical arrays across two calls. Same for seed = `STAR_SEED`.
- **Counts:** all five arrays have the expected lengths (`count` or `count * 3`).
- **Position radius:** every position vector has length ≈ `radius` (within float tolerance).
- **Size range:** every size ∈ `[STAR_SIZE_MIN, STAR_SIZE_MAX]`.
- **Brightness range:** every brightness ∈ `[STAR_BRIGHTNESS_MIN, STAR_BRIGHTNESS_MAX]`.
- **Twinkle ratio:** out of `count` stars, the fraction with `twinkleAmp > 0` is within `±0.03` of `TWINKLE_FRACTION` (tolerance for the random subset on a 1500-sample draw).
- **Twinkle amp values:** for stars with `twinkleAmp > 0`, every value ∈ `[TWINKLE_AMP_MIN, TWINKLE_AMP_MAX]`.

### Manual verification

- Run `pnpm dev`, load the scene.
- Visual check: the scene background is no longer flat black; stars visible across the dome.
- Pan the camera (fly the ship around): stars do not parallax — they sit "at infinity."
- Watch idle for ~10 seconds: a small subset of stars subtly pulses, the rest are static.
- Watch a planet pass in front of a star: the star is occluded correctly.
- Watch a comet fly across the star field: comet trail reads cleanly against stars (additive on additive — no clash).
- Frame-time check (Chrome devtools performance tab): no measurable change vs. main.

### Architectural verification

The work touches `services/renderer/` and `components/Scene/` only. No core changes, no port changes, no widget changes. The full pipeline pass (`pnpm check`) must pass — typecheck, oxlint, suppressor scan, unit tests.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| drei `<Stars>` with `speed=0` | No mechanism for partial twinkle (some pulse / most static). Would require either all-static (boring) or all-twinkle (loud). |
| Equirectangular skybox texture | Pre-baked stars can't pulse. Layering a pulse-only points layer on top is two systems where one does. |
| Per-vertex CPU twinkle update | Wastes CPU on something the GPU does for free via a single `uTime` uniform. |
| Star colors per spectral class | Real but adds visual noise that competes with planets. Single uniform color is quieter. |
| World-fixed sphere at large radius | User chose camera-anchored. Camera-anchored is cheaper and matches the "at infinity" feel. |
| Reactive to scene state | The starfield is pure background chrome. Reactivity would couple it to the FSM for no perceptual gain. |
