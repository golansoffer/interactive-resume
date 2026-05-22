# Spaceship Visual Treatment — Design

**Date:** 2026-05-22
**Scope:** Re-dress the player ship so it reads as a distinct, "powered-on" craft inside this scene's cyan/dark-space signature — fixing three concrete problems with the current rendering: (1) most of the hull sits at near-zero emissive against a near-black background and reads as silhouette-only; (2) the engine `Trail` shoots from a transparent point with no nozzle anchor on the body, so the exhaust looks bolted on; (3) the flat-shaded low-poly hull has no view-dependent shading, so the silhouette is a dark blob from any angle. Restrained "Heat & Power" direction: hull breathes, edges catch a cyan rim from the star, thruster nozzles glow at the rear, ship hovers softly when idle, and the boost press fires one ring-shaped shockwave. A single threshold-gated bloom pass lets the engine and shockwave sing without lighting up the hull.

---

## Goal

The ship is a Kenney `.glb` low-poly model loaded through `useGLTF` and dressed in `cloneAndDressShip` with cyan emissive on emissive-map slots only. The visual result reads as "asset from a pack." This spec turns that into a deliberate, in-scene craft without changing the model, without changing the kinematics, and without committing the project to a new global aesthetic.

The directional pick is **"Heat & Power, restrained" + one beat of drama on boost engage**:

1. **Hull breathes.** Repaint the hull base from near-black to a desaturated cool teal (`#2a3a44`) so unlit panels register against the void.
2. **Edges catch the star.** A soft cyan fresnel rim (low intensity, soft exponent) shows up on grazing-angle pixels. Reads as "the star catches the edges," never as a halo.
3. **Engine has a body.** Two additive nozzle billboards anchor the cyan exhaust to the rear of the hull, scaling with the smoothed boost factor.
4. **Windows quiet down.** The existing accent emissive drops from 0.95 → 0.6 so the windows stop carrying 95% of the visual load alone.
5. **Suspended, not pasted.** A small idle hover (±0.03u Y, ±0.6° roll) on the visual group decouples the visible ship from the kinematic pose without affecting motion or collision.
6. **One beat of drama on boost engage.** A one-shot expanding additive ring fires from the rear plane on the rising-edge of a boost press, fades out in ~0.35s, and is gated by the same bloom threshold so it actually reads as light, not as a flat circle.
7. **Minimum bloom.** A single `@react-three/postprocessing` Bloom pass with threshold `1.0` and intensity `0.25` lifts already-bright pixels only — nozzles, shockwave, accent emissive. The teal hull, the rim, and the planets are below threshold and don't bloom.

## Non-goals

- **No new ship model.** The Kenney `.glb` stays. Every dial in this spec works across every entry in the ship registry without per-ship art.
- **No global aesthetic shift.** Planets, sun, starfield, labels, comms dock — untouched.
- **No edge-outline / Tron / cel-shading.** Those were Direction B/C in the brainstorm; explicitly rejected.
- **No per-mesh art tuning.** The fresnel rim and hull repaint are global, applied through the existing `cloneAndDressShip` traversal.
- **No reactivity-to-motion-preference yet.** Idle hover and shockwave are small in amplitude and short in duration; if needed, a follow-up wires `prefers-reduced-motion`.
- **No new core domain logic.** The shockwave is reactive plumbing over the existing `BoostStep` signal (with a small additive extension). No new state machine.
- **No URL or persisted state.** Visual treatment is purely scene-side.
- **No scrolling scanlines, no animated panel-seam textures, no per-panel material variants.** Out of scope; not needed to clear the diagnosis.

---

## Architecture

### Layer touches

```
features/scene/services/renderer/
├── shipVisualPlan.ts                — extended: hull repaint + fresnel rim shader patch
├── boostController.ts               — extended: BoostStep gains `pressEdge: boolean`
├── boostController.test.ts          — extended: covers pressEdge rising-edge semantics
├── shockwaveController.ts           — NEW: pure ShockwaveStep state machine driven by pressEdge
├── shockwaveController.test.ts      — NEW
├── idleHoverOffset.ts               — NEW: pure (time) → { y, rollRad }
└── idleHoverOffset.test.ts          — NEW

features/scene/components/Scene/
├── Player.tsx                       — wires nozzle anchors, idle hover offset, shockwave, into the visual group
├── NozzleAnchors.tsx                — NEW: pure renderer; two additive billboards driven by boost factor
├── NozzleAnchors.test.tsx           — NEW
├── BoostShockwave.tsx               — NEW: pure renderer of ShockwaveStep
├── BoostShockwave.test.tsx          — NEW
└── Scene.tsx                        — wraps scene contents in <EffectComposer><Bloom /></EffectComposer>

package.json                         — add @react-three/postprocessing dependency
```

No new feature folder. No `core/` addition. No new types/schema/api directory in `features/scene/` — every type added lives next to its owner in `services/renderer/`.

### Dependency direction (Iron Law 1)

```
Player.tsx
  ├── NozzleAnchors.tsx ─── reads BoostStep.factor (port)
  ├── BoostShockwave.tsx ── reads ShockwaveStep (port)
  └── (in useFrame)
        ├── boostController.tick(...)  → BoostStep (with pressEdge)
        ├── shockwaveController.tick(BoostStep.pressEdge, delta) → ShockwaveStep
        ├── idleHoverOffset(time) → { y, rollRad }
        └── orientationController.tick(...)
```

- `services/renderer/*` stays pure: no React, no DOM, no THREE-side-effects beyond the existing pattern (`shipVisualPlan` already touches materials, that pattern stays).
- `components/Scene/*` renders pixels and emits events. Nozzle, shockwave, and the bloom composer all live here.
- `Player.tsx` remains the only file that calls `useFrame` for ship integration. It threads pure-controller outputs into pure-render children.
- The new shader patch in `shipVisualPlan.ts` is via `MeshStandardMaterial.onBeforeCompile` — the existing material is reshaped, no new material class. No information leaks across layers; the shader is an implementation detail of the renderer service.

### State carrier extensions

```ts
// services/renderer/boostController.ts
export type BoostStep =
  | { readonly kind: 'inactive'; readonly factor: number; readonly multiplier: 1; readonly pressEdge: boolean }
  | { readonly kind: 'active'; readonly factor: number; readonly multiplier: 3; readonly pressEdge: boolean };
```

`pressEdge` is `true` on exactly the frame `boostHeld` rises from `false` to `true` (the same edge the controller already detects to clear `cancelled`). It is `false` every other frame. Consumers that don't care about it ignore the field — `factor`/`multiplier`/`active` semantics are unchanged.

```ts
// services/renderer/shockwaveController.ts (new)
export type ShockwaveStep =
  | { readonly kind: 'idle' }
  | { readonly kind: 'active'; readonly t: number };  // 0..1, 1 = fully expanded & faded

export type ShockwaveController = {
  readonly tick: (pressEdge: boolean, delta: number) => ShockwaveStep;
};
```

Discriminated. No optionals. Illegal states unrepresentable (Iron Laws 2 + 3).

---

## Visual specification

Every dial below is a starting value backed by the diagnosis. They're not placeholders — they're the targets the implementation must hit. Anything that needs to move after seeing it in-engine moves through a follow-up edit, not by leaving knobs open here.

### Hull repaint

In `cloneAndDressShip`, after cloning the material:

- For **every** `MeshStandardMaterial` whose original `.color.getHexString()` reads as the Kenney dark grey (`333333` or darker, threshold `0.18` average channel), overwrite `m.color = new Color('#2a3a44')`.
- For materials *with* an `emissiveMap` (the existing accent-window slots), color is untouched — they're authored intentionally.
- `m.metalness` stays at its source value. `m.roughness` stays at its source value.

The visible effect: the previously near-black hull panels now register as cool teal against `#04050a`. The window emissives still read as cyan. Low-poly flatness is preserved.

### Fresnel rim shader patch

In `cloneAndDressShip`, on every `MeshStandardMaterial` instance, attach an `onBeforeCompile` patch that injects view-dependent emissive based on the angle between the surface normal and the view direction.

GLSL injection points (chunked via THREE's `<token>` markers):

```glsl
// injected after #include <common> in the vertex shader
varying vec3 vWorldNormalFR;
varying vec3 vWorldViewDirFR;

// injected at the end of the vertex shader's main()
vWorldNormalFR = normalize(mat3(modelMatrix) * normal);
vWorldViewDirFR = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
```

```glsl
// injected after #include <common> in the fragment shader
varying vec3 vWorldNormalFR;
varying vec3 vWorldViewDirFR;
uniform vec3 uFresnelColor;
uniform float uFresnelPower;
uniform float uFresnelIntensity;

// injected after #include <dithering_fragment> in meshphysical_frag (the actual chunk used by MeshStandardMaterial)
float fresnelTerm = pow(1.0 - clamp(dot(normalize(vWorldNormalFR), normalize(vWorldViewDirFR)), 0.0, 1.0), uFresnelPower);
gl_FragColor.rgb += uFresnelColor * fresnelTerm * uFresnelIntensity;
```

Uniform values:

| Uniform | Value | Why |
|---|---|---|
| `uFresnelColor` | `#9be6ff` (pale cyan) | Pairs with the trail/window emissive but slightly lighter so it reads as a light response, not a glow |
| `uFresnelPower` | `3.0` | Soft falloff — only grazing-angle pixels light up; "1.5" would be aggressive |
| `uFresnelIntensity` | `0.35` | Whisper-tier; "1.0" would be halo |

All three uniforms are attached via the userData on the material so a follow-up tweak doesn't require a recompile chain.

### Emissive intensity tweak

In `cloneAndDressShip`, drop `ACCENT_EMISSIVE_INTENSITY` from `0.95` → `0.6`. The window emissives stop carrying the whole hull's visual load alone; with the repainted base and the rim, `0.6` reads cleanly.

`HULL_EMISSIVE_INTENSITY` (currently `0.025`) is removed entirely — the fresnel rim is the new view-dependent kick on non-accent meshes. Materials without an `emissiveMap` get `emissive = black` and `emissiveIntensity = 0`.

### Nozzle anchors (`NozzleAnchors.tsx`)

Two additive billboarded discs at the ship's rear, parented to the same visual group as the trail.

- Geometry: drei `<Billboard>` containing a single `<mesh>` with `<circleGeometry args={[1, 32]}>` and `<meshBasicMaterial>` with:
  - `color`: cyan (idle) ↔ pale cyan (boost), driven by an animated lerp over the same boost factor used by the trail cross-fade.
  - `transparent: true`, `depthWrite: false`, `blending: AdditiveBlending`.
  - `opacity`: idle `0.5`, boost `0.9` (cross-faded by factor).
- Position: per-ship configured? **No** — start with a single pair of anchor offsets (`±0.18u` X, `0.0` Y, `0.42u` Z behind the model's center) that match the Kenney craft used today. If a future ship needs custom positions, add a `nozzles: ReadonlyArray<readonly [number, number, number]>` field to `ShipEntry`; out of scope here.
- Scale: idle radius `0.08u`, boost radius `0.12u`. Driven by `lerp(0.08, 0.12, factor)`. The size delta on boost is visible but not theatrical.

`NozzleAnchors` is a pure React component:

```tsx
type NozzleAnchorsProps = {
  readonly boostFactor: number;  // 0..1
};
```

Player.tsx writes the smoothed `factor` from `BoostStep` into this prop on every frame via a ref-stored material handle, mirroring the existing trail material handoff pattern (`writeTrailMaterial`). No direct prop re-render; the per-frame writes hit material/scale via the captured ref to avoid React reconciliation in `useFrame`.

### Idle hover (`idleHoverOffset.ts`)

Pure function:

```ts
export type IdleHover = { readonly y: number; readonly rollRad: number };

export const idleHoverOffset = (timeSeconds: number): IdleHover => ({
  y: Math.sin(timeSeconds * 2 * Math.PI * 0.7) * 0.03,
  rollRad: Math.sin(timeSeconds * 2 * Math.PI * 0.5 + Math.PI / 2) * (0.6 * Math.PI / 180),
});
```

- Vertical bob: ±0.03u, 0.7 Hz.
- Roll: ±0.6°, 0.5 Hz, 90° phase offset from the bob so they don't read as a single beat.
- Applied to the `visualRef` group in `Player.tsx` — **not** to the kinematic mesh (`meshRef`). Motion, heading, and collision are untouched.

The phase offset and frequency difference mean the bob+roll loops every ~10s without ever landing on a periodic-looking peak. Reads as "suspended."

### Boost shockwave (`BoostShockwave.tsx` + `shockwaveController.ts`)

**Controller** — pure state machine. Holds a single `t` value clamped to `[0, 1]`. On a `pressEdge` true, resets `t = 0` and transitions to `active`. On every subsequent tick, advances `t += delta / SHOCKWAVE_DURATION` (where `SHOCKWAVE_DURATION = 0.35`). When `t >= 1`, transitions back to `idle`. Re-trigger on a new `pressEdge` resets `t = 0` and stays active.

```ts
const SHOCKWAVE_DURATION = 0.35;

export const createShockwaveController = (): ShockwaveController => {
  let state: ShockwaveStep = { kind: 'idle' };
  return {
    tick: (pressEdge, delta) => {
      if (pressEdge) {
        state = { kind: 'active', t: 0 };
        return state;
      }
      if (state.kind === 'idle') return state;
      const nextT = state.t + delta / SHOCKWAVE_DURATION;
      state = nextT >= 1 ? { kind: 'idle' } : { kind: 'active', t: nextT };
      return state;
    },
  };
};
```

**Renderer** — `<BoostShockwave step={step} />`:

- When `step.kind === 'idle'`: returns `null`.
- When `step.kind === 'active'`: renders a quad behind the ship (ship-local Z = `+0.6u` behind the trail origin, facing forward — i.e. visible from the camera which trails the ship). Quad uses:
  - `<circleGeometry args={[1, 64]}>` flat, scaled by `lerp(0.4, 2.5, t)`.
  - `<meshBasicMaterial>` with a procedural ring shader patch: `gl_FragColor = vec4(uColor, smoothstep(1.0, 0.85, length(vUv * 2.0 - 1.0)) * smoothstep(0.65, 0.85, length(vUv * 2.0 - 1.0)) * uOpacity);` — gives a soft-edged ring, not a filled disc.
  - `uColor = #aeefff`, `uOpacity = 0.8 * (1 - t)`.
  - `transparent: true`, `depthWrite: false`, `blending: AdditiveBlending`.

The shockwave fires within ~0.35s, expands from `0.4u` to `2.5u` diameter, fades opacity from 0.8 → 0, and is consumed by the bloom pass (its peak opacity puts it just above the bloom threshold).

### Bloom postprocess (Scene.tsx)

Wrap scene contents in `<EffectComposer>` with a single `<Bloom>` effect:

```tsx
import { EffectComposer, Bloom } from '@react-three/postprocessing';

<EffectComposer enableNormalPass={false}>
  <Bloom
    intensity={0.25}
    luminanceThreshold={1.0}
    luminanceSmoothing={0.9}
    mipmapBlur
  />
</EffectComposer>
```

- `luminanceThreshold: 1.0` — only pixels that are already above sRGB `(1,1,1)` peak in HDR space lift. This means: the teal hull, the fresnel rim, the starfield stars, the planets, the labels, the sun glow — none of them bloom. Only the additive nozzle billboards, the shockwave, and the cyan accent emissive (multiplied by their high emissiveIntensity) clear the threshold.
- `intensity: 0.25` — gentle. Doubling this is the dial if "powered" reads as "underpowered" in-engine.
- `luminanceSmoothing: 0.9` — soft cut-in around the threshold, avoids hard pop-in on the rising shockwave.
- `mipmapBlur` — the cheap, high-quality blur mode.

EffectComposer wraps **all** scene contents — it's the standard R3F postprocessing pattern. The composer respects depth-test and renders to the same canvas; no DOM changes; existing components don't change shape.

---

## Data flow

Per frame, in `Player.tsx`'s `useFrame`:

```
1. boostHeld = props.intents.current.has('boost')
2. newPlanetEntry = detectNewPlanetEntry(...)
3. boostStep = boostController.tick(boostHeld, newPlanetEntry, delta)
                ↓ (existing) writes boostSignalRef
4. shockwaveStep = shockwaveController.tick(boostStep.pressEdge, delta)
5. hover = idleHoverOffset(state.clock.elapsedTime)
6. stepKinematics(...)      → existing, unchanged
7. orientationController.tick(mesh, visualRef, ...)
                ↓ existing — writes mesh world pose and visualRef tween
8. Apply hover offset to visualRef.position.y and visualRef.rotation.z
                 (additive on top of orientationController's output)
9. writeTrailOpacities(...)  existing
10. writeNozzleState(boostStep.factor)   (mirrors writeTrailOpacities pattern)
11. writeShockwaveState(shockwaveStep)
```

Steps 4, 5, 8, 10, 11 are new. Everything else is the existing loop.

The `pressEdge` field is computed once per frame inside `boostController.tick` — it's the same `boostHeld && !prevHeld` check the controller already uses internally to reset `cancelled`. Exposing it on the returned step costs nothing.

---

## Failure & boundary handling

- **Empty meshes / missing emissive map:** `cloneAndDressShip` already traverses every Mesh and skips non-`MeshStandardMaterial`. The hull repaint check applies only when the cloned material's existing color is dark; bright-painted ship variants in the registry stay bright.
- **Shader patch compile errors:** `onBeforeCompile` patches are applied to every material clone. If THREE upgrades break a chunk token, the failure surfaces as a black mesh — caught in dev. No runtime guard; the spec assumes the THREE major version is pinned in `package.json` (currently `^0.184.0`).
- **`enableNormalPass={false}`:** The bloom effect doesn't need a normal pass. If a future postprocess effect needs normals, that's the moment to flip this — not now.
- **Postprocess on low-end devices:** `mipmapBlur` is the cheap path. The Bloom pass is single-pass; impact is one screen-size mipmap chain per frame. Acceptable on the target devices. If a follow-up adds DoF/SSAO, performance must be re-evaluated; not in scope here.
- **Re-trigger of boost during a still-active shockwave:** Controller resets `t = 0` and stays `active` — the visible result is the previous ring instantly disappears and a new ring expands. Acceptable: a player can't realistically tap boost twice in <0.35s and expect both rings to compose. Documented in the controller test.

---

## Testing

Pure controllers and pure functions get unit tests. Renderers get smoke tests (mount + minimal assertions). Visual treatment overall is validated by running the dev server.

### Unit tests (pure)

**`shockwaveController.test.ts`** (new)
- Starts in `idle`.
- `tick(false, 0.016)` while `idle` → still `idle`.
- `tick(true, 0.016)` → transitions to `active` with `t = 0`.
- Successive `tick(false, 0.1)` calls advance `t` by `0.1 / 0.35`.
- When `t` would exceed `1.0`, returns to `idle`.
- Mid-active `tick(true, ...)` resets `t = 0`, stays `active`.

**`boostController.test.ts`** (extended)
- New cases assert `pressEdge` semantics: `false` at start, `true` on the first frame of a held press, `false` on subsequent frames of the same press, `false` on release, `true` again on a fresh press.
- Existing tests (factor lerp, cancel-on-proximity, multiplier gating) unchanged.

**`idleHoverOffset.test.ts`** (new)
- Pure function: known inputs produce known outputs.
- Bob amplitude bounded by ±0.03.
- Roll amplitude bounded by ±0.6° (in radians).
- Phase offset checked at `t=0` (bob 0, roll at max-ish).

**`shipVisualPlan.test.ts`** (existing, extended — if it exists; otherwise new)
- After `cloneAndDressShip`, every standard material has a non-null `onBeforeCompile` and `userData.uFresnelColor === '#9be6ff'` (or similar; the test asserts the uniform handle exists with the right value).
- Materials with an `emissiveMap` retain accent emissive at intensity `0.6`.
- Materials without an `emissiveMap` have `emissiveIntensity === 0`.
- Materials with original color below the dark-grey threshold get repainted to `#2a3a44`.
- Materials with original color above the threshold keep their color.

### Component smoke tests

**`NozzleAnchors.test.tsx`** — renders with `boostFactor = 0` and `boostFactor = 1`; asserts two billboard meshes exist; asserts the additive material is configured.

**`BoostShockwave.test.tsx`** — renders `step={{ kind: 'idle' }}` → `container.firstChild === null`; renders `step={{ kind: 'active', t: 0.5 }}` → renders a circle mesh with scaled radius and reduced opacity.

### Manual verification

- Start the dev server, fly the ship.
- Confirm hull reads as cool teal, windows still cyan.
- Confirm fresnel rim catches at side-on angles.
- Confirm both nozzles glow, brighter under boost.
- Confirm idle hover is visible but not seasick-y.
- Confirm one shockwave fires per boost press, fades in ~0.35s, reads as light (bloom-amplified), not as a flat circle.
- Confirm no bloom artifacts on planets / starfield / labels / sun.
- Confirm frame rate is unchanged within noise (single Bloom pass).

---

## Implementation order

1. Add `@react-three/postprocessing` dependency. `pnpm add @react-three/postprocessing`.
2. Extend `BoostStep` with `pressEdge`; update `boostController.ts` and `boostController.test.ts`. All existing call sites continue to compile (the field is additive).
3. Add `shockwaveController.ts` + test.
4. Add `idleHoverOffset.ts` + test.
5. Extend `cloneAndDressShip` in `shipVisualPlan.ts`: hull repaint, fresnel `onBeforeCompile` patch, emissive intensity drop. Add/extend test.
6. Add `NozzleAnchors.tsx` + smoke test.
7. Add `BoostShockwave.tsx` + smoke test.
8. Wire all new pieces into `Player.tsx` — controller instantiation, per-frame writes, visual-group hover offset, child component mounts.
9. Wrap `Scene.tsx` children in `<EffectComposer><Bloom /></EffectComposer>`.
10. Manual verification pass. Tune the three top-priority dials only if a target reads wrong (bloom intensity, fresnel intensity, nozzle radius). Anything else stays.

Each step is a complete, self-contained unit. No "we'll wire it later" half-states. No commented-out scaffolding. No TODOs left behind.
