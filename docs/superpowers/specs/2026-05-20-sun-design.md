# Sun — Design Spec

**Date:** 2026-05-20
**Status:** Approved (pending user spec review)
**Scope:** Add a stylized, light-emitting Sun at the center of the company-planet ring.

---

## Goal

Place a sun at the origin of the scene that:

1. Reads as a distinct, hero-scale celestial body (5× the planets).
2. Has a strong, tasteful glow appropriate to the existing **low-poly / pastel colorsheet** art direction — *not* photoreal HDR bloom.
3. Acts as a localized light source: when the player ship is near the sun it gets a clear warm wash; far away the effect is imperceptible.
4. Cannot be entered — the player ship stops at the sun's surface.

Performance budget: zero post-processing passes, zero new heavyweight deps, all effects in-mesh.

---

## Non-Goals

- No physical / threshold bloom (rejected — clashes with the stylized aesthetic).
- No planet-side physical collision (out of scope; existing planet system stays as-is).
- No flare / lens-effect / volumetric scattering.
- No mechanic where the sun affects gameplay beyond visual lighting on the ship.

---

## Visual Design

### Body

- Model: `/models/planets/EA05_Planets_Sun_01b.glb` (`sun_b` asset id, already registered in `PLANET_PATHS`).
- Scale: `5 × PLANET_BASE_SCALE = 7.5` (planets are `1.5`).
- Material override on the body mesh:
  - `emissive` = `#ffe9b0` (warm yellow-white)
  - `emissiveIntensity` ≈ `1.2`
  - `toneMapped` = `false` (so the renderer's tone curve doesn't crush the hot core).
- Slow self-rotation around the Y axis (rate similar to the slowest planet — discovery-time, not action-time).

### Inner Corona

- Geometry: single `PlaneGeometry`, billboarded toward the camera each frame.
- Size: ~1.5× the body's visible diameter.
- Custom `ShaderMaterial`:
  - Fragment paints a radial gradient: hot near the center (`#ffe9b0`), warm at the rim (`#ffcf72`), transparent at the edge.
  - Sharpish falloff curve (e.g. `pow(1 - r, 2.4)`) so it reads as a defined ring of light, not a soft blob.
  - `blending = AdditiveBlending`, `depthWrite = false`, `transparent = true`.
- Pulse: opacity modulated by `1 + sin(t · 2π · 0.08) · 0.10` (10% amplitude, ~0.08 Hz).

### Outer Halo

- Same geometry/material family as the corona, but:
  - Size: ~3.5× body diameter.
  - Color skews warmer (`#ff9a3a` rim).
  - Peak opacity ~0.25 (much softer).
  - Counter-phase pulse: `1 + sin(t · 2π · 0.08 + π) · 0.12`.

### Draw Order

- Body draws first with normal depth writes.
- Corona and halo are added as siblings of the body inside the sun group, with `renderOrder` set so they render after the body.
- Additive + `depthWrite:false` ensures no z-fighting against the body or each other.

---

## Lighting

Existing scene lighting is **untouched** to keep the rest of the scene visually stable:

- `ambientLight intensity={0.4}` — kept.
- Both `directionalLight`s — kept.

A new local light is added at the sun position:

- `PointLight`
  - color: `#ffcf8f`
  - position: `(0, 0, 0)` (same as sun mesh; attached to the sun group)
  - `intensity` ≈ `120` (tuned during impl — high enough to clearly warm the ship at close range)
  - `distance` ≈ `45` (Three.js bounded falloff — intensity reaches 0 at this distance, so it cannot reach the planet ring at radius 80)
  - `decay` = `2` (physically natural inverse-square falloff inside the bounded range)
  - `castShadow` = `false`

This gives the user the requested behavior:
- Up close, the ship's PBR materials get a strong warm tint contribution.
- At the planet ring, the contribution is mathematically zero, so planet appearance is unchanged.

---

## Player Collision

The existing `planetRadii` ref is for **proximity activation** (info-panel triggers), not collision. The player ship currently has no physical collision with anything.

This spec adds the minimum collision infrastructure for the sun **and nothing else**:

- New pure function in `services/renderer/`:
  - `clampOutOfSphere(position: Vec3, sphere: { center: Vec3; radius: number }): Vec3`
  - If `position` is inside the sphere, returns the projection of `position` onto the sphere surface. Otherwise returns `position` unchanged.
  - Pure; unit-tested.
- `Player.tsx` `useFrame` calls `clampOutOfSphere` after `integrateMotion`, using a registered sun obstacle.
- The sun obstacle is registered via a new ref `sunColliderRef` on `useSceneRefs`, populated by the `Sun` component once its scaled body radius is measurable.
- Velocity is *not* corrected on contact in this iteration — the ship simply cannot penetrate the sphere. Tangential motion (sliding along the surface) emerges naturally from re-clamping each frame.

The function is shape-named for the general case so any future planet collision is a one-line addition (`obstacles.reduce(clampOutOfSphere, pos)`). We register only the sun today.

---

## Architecture

Per the project's hexagonal layering:

```
src/features/scene/
├── services/renderer/
│   ├── sunMaterial.ts            (new) pure shader factories: coronaMaterial(), haloMaterial()
│   ├── sunMaterial.test.ts       (new) uniform shape + blending mode assertions
│   ├── sunAnimation.ts           (new) pure (t) → { bodyRotationY, coronaPulse, haloPulse }
│   ├── sunAnimation.test.ts      (new) sample-point assertions
│   ├── clampOutOfSphere.ts       (new) pure sphere-exclusion function
│   └── clampOutOfSphere.test.ts  (new)
├── components/Scene/
│   ├── Sun.tsx                   (new) pure renderer: GLB body + corona + halo + PointLight
│   ├── Scene.tsx                 (edit) mount <Sun /> after <Starfield />
│   ├── Player.tsx                (edit) apply clampOutOfSphere(pos, sunObstacle) post-integrate
│   └── useSceneRefs.ts           (edit) add sunColliderRef: RefObject<SunCollider>
```

Layer responsibilities (CLAUDE.md compliance):

- `sunMaterial.ts` / `sunAnimation.ts` / `clampOutOfSphere.ts` — `services/renderer/`: pure, no React, no DOM, no domain. Externality wrappers and math only.
- `Sun.tsx` — `components/`: props in (none required), no api/router/store. Owns its own visual instantiation. Registers its collider into `sunColliderRef` once mounted (same pattern as `Planet.tsx` registering its radius into `planetRadiiRef`).
- `Scene.tsx` — composition only; no logic.
- `Player.tsx` — already a composition root; gains one line to read the collider ref and clamp.
- `useSceneRefs.ts` — ref factory; gains one ref.

No new feature folder needed — sun is part of the existing `scene` feature.

---

## Animation Function (pure)

```ts
// sunAnimation.ts
export type SunAnimationState = {
  readonly bodyRotationY: number; // radians
  readonly coronaOpacityScale: number; // ~ [0.9, 1.1]
  readonly haloOpacityScale: number;   // ~ [0.88, 1.12], counter-phase
};

export const sunAnimationAt = (timeSeconds: number): SunAnimationState => ({
  bodyRotationY: timeSeconds * SUN_ROTATION_RATE,
  coronaOpacityScale: 1 + Math.sin(timeSeconds * TWO_PI * CORONA_PULSE_HZ) * CORONA_PULSE_AMP,
  haloOpacityScale: 1 + Math.sin(timeSeconds * TWO_PI * HALO_PULSE_HZ + Math.PI) * HALO_PULSE_AMP,
});
```

Constants pinned in `sunAnimation.ts`:

```ts
const SUN_ROTATION_RATE = 0.05;   // rad/sec — discovery-time, very slow
const CORONA_PULSE_HZ   = 0.08;
const CORONA_PULSE_AMP  = 0.10;
const HALO_PULSE_HZ     = 0.08;
const HALO_PULSE_AMP    = 0.12;
const TWO_PI            = Math.PI * 2;
```

Sun.tsx calls `sunAnimationAt(state.clock.elapsedTime)` once per frame and applies the values; the function is pure and tested in isolation.

**Corona/halo billboard sizes** are computed from the body's measured radius (same `extractBody` pattern as `Planet.tsx`), not from constants — so any future swap of the sun GLB scales the visual stack automatically:

- `CORONA_SCALE_OF_DIAMETER = 1.5`
- `HALO_SCALE_OF_DIAMETER   = 3.5`

---

## Tests

Following existing patterns in `services/renderer/*.test.ts`:

1. `sunMaterial.test.ts`
   - Corona/halo materials use `AdditiveBlending`.
   - `depthWrite` is `false`, `transparent` is `true`, `toneMapped` is `false`.
   - Required uniforms (`uColorCore`, `uColorRim`, `uOpacityScale`) are present with correct initial values.
2. `sunAnimation.test.ts`
   - `sunAnimationAt(0)` → body rotation 0, pulses at expected baseline.
   - Sample at `t = 1 / (4 · CORONA_PULSE_HZ)` (quarter-period) → corona at max amplitude.
   - Halo and corona are counter-phase at any `t > 0` where both are at extremes.
3. `clampOutOfSphere.test.ts`
   - Point outside sphere: returned unchanged.
   - Point inside sphere: returned on the surface, same direction from center.
   - Point at center: returned at any point on the surface (degenerate case — pick `+Y`).
   - Idempotence: `clamp(clamp(p, s), s) === clamp(p, s)`.

No component-level tests required (Sun.tsx is a pure renderer; visual correctness verified in-browser).

---

## Acceptance Criteria

1. `pnpm check` passes (typecheck + lint + suppressor scan + tests).
2. Dev server: sun visible at scene center, dwarfing planets (~5×).
3. Sun has visible warm corona + softer outer halo, both pulse subtly out of phase.
4. Flying close to the sun: ship lights up with a warm tint that intensifies as the player approaches.
5. Flying at the planet ring (radius ~80): sun lighting contribution is imperceptible; planet appearance unchanged from before.
6. Player cannot fly through the sun — motion stops at the surface, can slide along it.
7. No new postprocessing / EffectComposer setup; no new heavyweight deps.
8. No `@ts-ignore`, `!`, `as` casts on lookups, `disable` comments, or other suppressor patterns introduced.

---

## Open Risks

- **Halo billboard popping near camera proximity.** Mitigation: billboard math uses the camera position each frame; render order forces halo after body. If popping appears in playtest, tune the halo's `renderOrder` and `polygonOffset`.
- **PointLight `intensity` value depends on the renderer's tone-mapping/exposure settings.** Mitigation: tune during implementation against the live scene; spec lists `~120` as a starting point, not a hard number.
- **Sun radius measurement.** The sun GLB's body radius is currently extracted via `extractBody()` in `planetVisualPlan.ts`. The sun reuses this extractor — same pattern as `Planet.tsx` — so no new measurement code path is needed.
