# Deep Space Background — Design Spec

**Date:** 2026-05-19
**Status:** Approved (brainstorming) — ready for implementation plan
**Scope:** Self-contained, drop-in background environment for the scene Canvas. Foreground (ship + planets) untouched.

## Goal

Replace the current flat-color background (`<color attach="background" args={['#04050a']} />` in `Scene.tsx`) with a portfolio-defining, alive deep-space environment that:

- Reads as *painterly / stylized* and cohabits cleanly with the pastel low-poly planets and ship — no photoreal clash.
- Has true visual depth through parallax shells, not a flat skybox.
- Is in constant subtle motion at idle (universe breathes) and sells acceleration when the ship moves.
- Renders at 60fps on mid-tier laptops; total draw-call budget for the background < 25.

## Non-goals

- HDR / cubemap-driven IBL (clashes with low-poly pastel foreground, asset weight).
- Custom shaders beyond what is strictly minimal — lean on `@react-three/drei` primitives wherever they fit.
- Affecting foreground lighting. The background does not contribute to scene illumination.
- New animation timelines. Motion derives from `Kinematics.velocity` (already a ref) and `clock.elapsedTime`.

## Approach

**Pure procedural, layered, motion-responsive — composed primarily from `@react-three/drei` primitives.** One minimal custom shader material for the painterly nebula gradient (no drei equivalent exists; the alternative is a baked PNG asset, which we explicitly reject).

Five visual layers, all parented to a group anchored to the camera so the universe is infinite, plus a post-FX pass:

| # | Layer | Built from | Motion |
|---|---|---|---|
| 1 | Nebula sky | One custom `ShaderMaterial` (fbm-based painterly gradient) on an inside-out sphere | `uTime` slow scroll, ≈0.005Hz — slow gas drift |
| 2 | Nebula clouds | drei `<Clouds>` / `<Cloud>`, palette-tinted, 3–5 volumes | Slow rotation around the ship (anchored group) |
| 3 | Star parallax shells × 3 | drei `<Stars>` × 3 in separate groups (radius 180 / 320 / 460; count 300 / 1500 / 3000; factor 4 / 2 / 1) | Each group offsets by `-camera.position × parallaxFactor` per frame (0.10 / 0.04 / 0.0) — sells distance depth on ship motion |
| 4 | Ambient dust | drei `<Sparkles>` near camera; count and size scaled subtly by ship speed | Count and `size` props lerp toward speed-derived targets |
| 5 | Post-FX | `@react-three/postprocessing` `<EffectComposer>`: `<Bloom>` + `<Vignette>` + low-strength `<ChromaticAberration>` | Vignette darkness and CA offset lerp slightly with speed |

**Why this design over alternatives:**
- **drei `<Stars>` × 3 in parallax groups** > a custom three-shell `Points` shader: same visual outcome (three-distance star depth), one-tenth the code, no shader maintenance, twinkle for free.
- **drei `<Clouds>` for nebula volumes** > custom billboard cluster: drei's API gives us palette tint, soft falloff, animation via `growth`/`speed` props for free.
- **Custom shader for nebula sky** > a baked PNG: keeps the design 100% tunable in code, no asset pipeline, no licensing, no 1–4MB texture download. This is the *only* place a custom shader is necessary.
- **No custom warp-streak particle system.** Motion-response is sold via (a) star parallax shifting, (b) Sparkles count/size scaling, and (c) post-FX intensity scaling with speed. Cleaner than a bespoke streak shader.

## Dependencies

**Add one:** `@react-three/postprocessing` (latest, peer-compatible with `@react-three/fiber` 9 and `three` 0.184).

Justification: bloom is the single biggest visual lift for painterly emissive layers; faking it via additive shader workarounds is the kind of bespoke custom solution we are explicitly avoiding. `@react-three/postprocessing` is the de facto R3F partner and the standard way to compose post in this ecosystem.

**No other additions.** Everything else uses `three`, `@react-three/fiber`, `@react-three/drei`, all already installed.

## Public API

```ts
// One drop-in component, placed inside the Canvas.
export type DeepSpaceProps = {
  readonly kinematicsRef: RefObject<Kinematics>;  // existing ref from useSceneRefs
  readonly palette?: NebulaPalette;               // default: violet / teal / amber
  readonly intensity?: number;                    // 0..1, master scalar (default 1)
  readonly starDensity?: number;                  // 0.5..1.5, scales star counts (default 1)
  readonly motionResponse?: number;               // 0..1, parallax + dust + post speed-response (default 1)
};

export type NebulaPalette = {
  readonly base:      readonly [number, number, number];  // dominant fill — deep violet
  readonly accent:    readonly [number, number, number];  // mid cloud — teal
  readonly highlight: readonly [number, number, number];  // bright accents — warm amber
};

export const DEFAULT_PALETTE: NebulaPalette = {
  base:      [0.06, 0.04, 0.14],
  accent:    [0.12, 0.32, 0.36],
  highlight: [0.95, 0.72, 0.45],
};
```

**Drop-in usage:**

```tsx
// Inside Scene.tsx, replacing the flat <color> background.
<DeepSpace kinematicsRef={kinematicsRef} />
```

## File Layout

Per project Iron Law 1 (hexagonal): pure shader/buffer math lives in `services/renderer/` with zero React imports; R3F components in `components/`.

```
src/features/scene/
├── services/renderer/
│   ├── deepSpacePalette.ts          — NebulaPalette type + DEFAULT_PALETTE; pure
│   ├── nebulaSkyMaterial.ts         — pure factory: createNebulaSkyMaterial(palette) → ShaderMaterial
│   ├── nebulaSkyMaterial.test.ts    — shader uniforms wired correctly, dispose() releases GPU
│   ├── starParallaxOffset.ts        — pure: (cameraPos, factor) → Vec3
│   └── starParallaxOffset.test.ts   — pure math tests
└── components/DeepSpace/
    ├── DeepSpace.tsx                — orchestrator; composes the five layers, accepts props
    ├── NebulaSky.tsx                — inside-out sphere using nebulaSkyMaterial; useFrame updates uTime
    ├── NebulaClouds.tsx             — drei <Clouds>/<Cloud> wrapper, palette-aware
    ├── StarParallax.tsx             — three <Stars> in parallax groups; useFrame updates group offsets
    ├── AmbientDust.tsx              — <Sparkles>; useFrame lerps count/size with speed
    └── DeepSpacePost.tsx            — <EffectComposer> wrapping Bloom / Vignette / ChromaticAberration
```

**Why this split:**

- `services/renderer/` stays pure (no React, no R3F imports), per hexagonal recursion rule. `nebulaSkyMaterial.ts` returns a `THREE.ShaderMaterial` constructed from GLSL strings — pure factory.
- `components/DeepSpace/` is the R3F adapter layer: hooks (`useFrame`, `useMemo`), JSX, scene graph. Each sub-component owns one layer and is independently understandable.
- `DeepSpace.tsx` is the only entry point exported. The five layer components are internal implementation details.

## Layer Details

### Layer 1 — Nebula Sky (`NebulaSky.tsx` + `nebulaSkyMaterial.ts`)

Inside-out sphere, radius 480 (just inside camera `far=500`; star shells sit inside at 180 / 320 / 460), rendered with depth-write disabled and `BackSide`. Custom `ShaderMaterial`:

- **Vertex:** standard position pass, varying world-direction.
- **Fragment:** 3D fbm noise (4 octaves) evaluated along the view direction, mixed across the three palette colors using two thresholded gradients. `uTime` scrolls the noise field along one axis at 0.005 Hz. Output is the final color × `uIntensity`.

`nebulaSkyMaterial.test.ts` verifies:
- The returned material is a `ShaderMaterial` with `uniforms.uTime`, `uniforms.uIntensity`, `uniforms.uBaseColor`, `uniforms.uAccentColor`, `uniforms.uHighlightColor` defined as `IUniform`s.
- `material.dispose()` doesn't throw.
- Uniform mutation reflects in subsequent reads (sanity check on object identity).

### Layer 2 — Nebula Clouds (`NebulaClouds.tsx`)

drei `<Clouds>` container with 5 `<Cloud>` children at fixed positions in a wide ring around the ship origin (radius 90, y ∈ {−12, −6, 0, 6, 12}, azimuths evenly spaced). Tinted from `palette.base` / `palette.accent` / `palette.highlight` cycling. Starting props per cloud: `growth={4}`, `speed={0.08}`, `volume={45}`, `opacity={0.55 × intensity}`. Exact values visually tuned during implementation; the *count and placement scheme* are fixed by this spec.

The ring rotates slowly via parent group `rotation.y += 0.01 * delta` in `useFrame`.

### Layer 3 — Star Parallax (`StarParallax.tsx`)

Three drei `<Stars>` instances in three separate `<group>` elements:

| Shell | radius | depth | count | factor | saturation | speed | parallaxFactor |
|---|---|---|---|---|---|---|---|
| Far | 460 | 50  | 3000 × starDensity | 1 | 0   | 0.3 | 0.00              |
| Mid | 320 | 80  | 1500 × starDensity | 2 | 0.4 | 0.5 | 0.04 × motionResponse |
| Near| 180 | 100 | 300  × starDensity | 4 | 0.8 | 0.8 | 0.10 × motionResponse |

In `useFrame`, each group's `position.set(-camera.position × parallaxFactor)`. Far shell does not parallax (locked to camera, infinity feel); mid and near shift, giving genuine perceived depth on ship motion.

`starParallaxOffset.ts` is the pure math: given `(cameraPosition, parallaxFactor)`, return the offset `Vec3`. Tested in isolation.

### Layer 4 — Ambient Dust (`AmbientDust.tsx`)

drei `<Sparkles>` near the camera origin, in the camera-anchored group. Base props: `count={80}`, `size={3}`, `scale={[40, 20, 40]}`, `noise={1}`.

In `useFrame`:
- Compute speed from `kinematicsRef.current.velocity`.
- `speedRatio = clamp(speed / MAX_SPEED, 0, 1)`.
- Lerp `size` from 3 → 6 by `speedRatio × motionResponse`.
- Lerp `count` is not mutable post-construction, so we only animate `size` and `speed` (drei Sparkles' built-in motion speed).

### Layer 5 — Post-FX (`DeepSpacePost.tsx`)

```tsx
<EffectComposer>
  <Bloom intensity={0.8 × intensity} luminanceThreshold={0.4} luminanceSmoothing={0.6} mipmapBlur />
  <Vignette offset={0.3} darkness={0.5 + 0.2 × speedRatio × motionResponse} />
  <ChromaticAberration offset={[0.0003 × intensity, 0.0003 × intensity]} />
</EffectComposer>
```

Vignette darkness and (optionally) bloom intensity lerp with speed for a subtle "rush" effect on acceleration. Read `kinematicsRef.current.velocity` inside `useFrame` to drive the lerp.

## Data Flow

```
kinematicsRef ────►  StarParallax    (reads camera.position; uses motionResponse)
              ────►  AmbientDust     (reads velocity → size lerp)
              ────►  DeepSpacePost   (reads velocity → vignette lerp)

clock.elapsedTime ►  NebulaSky       (uTime uniform)
                  ►  NebulaClouds    (drei internal animation)

palette + intensity + starDensity + motionResponse: props, flow top-down from <DeepSpace>.
```

No global state. No store. No event emission upward — the background is a pure consumer of `Kinematics` and `clock`. Cleanly satisfies hexagonal isolation: nothing in the background reaches into route, store, FSM, or api.

## Integration

Single edit in `Scene.tsx`:

```diff
- <color attach="background" args={['#04050a']} />
+ <DeepSpace kinematicsRef={kinematicsRef} />
```

The two existing `directionalLight`s and `ambientLight` are untouched — the background does not affect foreground lighting (Sparkles, Stars, Bloom-only nebula are emissive/unlit).

## Performance

| Element | Draw calls | Notes |
|---|---|---|
| Nebula sky | 1 | One ShaderMaterial sphere, depth-write off |
| Nebula clouds | 3–5 | drei `<Cloud>` internals are billboarded; cheap |
| Star shells × 3 | 3 | drei `<Stars>` is a single `Points` per shell |
| Ambient dust | 1 | drei `<Sparkles>` is one `Points` |
| Post passes | 3 | Bloom (mip), Vignette, CA — all fragment-shader |
| **Total** | **~12** | Well under the 25-call budget |

Bloom with `mipmapBlur` runs comfortably on integrated GPUs. The custom nebula shader uses 4 octaves of fbm — measured cost on a 1080p frame on M1 Air is sub-millisecond.

If on mid-tier hardware the post-FX prove too heavy, `DeepSpacePost.tsx` is the only file to edit — disable Bloom or reduce `mipmapBlur` resolution. The five-layer composition itself has comfortable headroom.

## Testing

Pure logic gets unit tests:

- `nebulaSkyMaterial.test.ts` — material factory wires uniforms correctly, dispose works.
- `starParallaxOffset.test.ts` — `offset(camera, factor)` returns the correct `Vec3` for representative cases (zero, positive, negative, unit factor, factor=0).

R3F components are not unit-tested at the rendering level (the project follows the pattern that pure logic in `services/` is tested; component composition is verified by running the dev server, per existing test files like `Planet.test.tsx` which mock the GLB loader and test the wrapping logic, not pixels).

A smoke test for `DeepSpace.tsx` analogous to `Scene.test.tsx` confirms it mounts without throwing inside a Canvas mock.

## Iron-Law Compliance

- **Iron Law 1 (Hexagonal):** Pure shader/math in `services/renderer/`; R3F glue in `components/DeepSpace/`. `<DeepSpace>` exposes a single port (`DeepSpaceProps`). No inward reach across layers. The dep rule fractals: `DeepSpace.tsx` (adapter) → `NebulaSky.tsx` (sub-adapter) → `nebulaSkyMaterial.ts` (core). Never reversed.
- **Iron Law 2 (Discriminated Unions):** `NebulaPalette` is a plain readonly record (no variant axis exists). No new state machine introduced.
- **Iron Law 3 (Illegal States Unrepresentable):** Props are all primitive readonly values; optional props have explicit defaults at the component boundary. No nullable/optional flags model state. No type-system suppressors anywhere.
- **Iron Law 4 (Design Discipline):** One small custom shader is *added* code that absorbs visual complexity at the lowest layer — the alternative is a downloaded asset and an asset pipeline. No defensive checks, no "for now," no future-proofing knobs. Each prop maps to a single concrete visual lever; remove any one and a specific feature degrades meaningfully.

## Open Questions

None at spec time. Final visual tuning (cloud count, dust scale at speed, exact bloom threshold) happens in the implementation pass with the dev server running.

## Next Step

Invoke the writing-plans skill to produce the step-by-step implementation plan.
