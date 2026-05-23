# Planet Cosmetics — Design

Date: 2026-05-23
Status: Draft (awaiting user review)

## Goals

Two subtle cosmetic moves on the planets to make the whole field feel more "alive" without touching the active-state rim and without adding any new visual vocabulary that competes for attention.

- **A — Silhouette outline.** Every planet gets a thin, dark, always-on illustrated outline at its silhouette. No animation, no shimmer, no activation gating.
- **B — Universal gentle pulse.** Every planet breathes via a low-amplitude emissive pulse. The six "active-capable" planets (`*_b` variants currently configured) keep their existing characterful pulses unchanged; the other sixteen previously-static planets gain a default soft pulse.

The active-mode rim (the fresnel atmosphere that fades in/out on proximity) is untouched.

## Non-goals

- No change to the active rim shader, timing, scale, or activation gating.
- No new GLTF assets, no new textures, no change to the shared colorsheet.
- No per-planet tuning beyond what each currently has; the sixteen previously-plain planets share one default pulse spec.
- No surface motion (rotating shadow bands, drifting highlights). Existing planet rotation + sway already provide motion.
- No new exported component API. All changes are internal to `services/renderer/` + `types/`.

## Visual specs

### Outline

- **Geometry.** Clone the body mesh's geometry, recompute smooth vertex normals (kills flat-shading discontinuities at the silhouette), re-center on the body's bounding-sphere center.
- **Material.** `MeshBasicMaterial` with:
  - `color`: near-black (`0x080808`).
  - `side: BackSide` (renders back faces of the slightly-inflated shell — the body's own depth occludes everything except the rim around the silhouette).
  - `transparent: true`.
  - `opacity`: ~0.55 (tunable at integration).
  - `depthWrite: false`, `depthTest: true`.
- **Scale.** ~1.025 of the body radius — large enough to be visible, small enough not to read as a halo.
- **Render order.** `renderOrder = 0` (drawn before the atmosphere, which gets `renderOrder = 1`). Active-mode additive atmosphere brightens over the outline naturally; outline reads clean when inactive.
- **Attachment.** Sibling-of-sorts to the atmosphere rim — both are children of the body mesh, both built off a clone of body geometry, both follow body transforms automatically.
- **No animation.** Static every frame. No uniforms to write per frame.

### Pulse (universal)

- The existing per-asset pulses on `*_b` planets remain unchanged in feel.
- For the sixteen previously-plain assets, a default pulse:
  - `amplitude`: 0.12
  - `frequencyHz`: 0.05 (period ~20s — slower than the active pulses, so the two cohorts read as different rhythms)
  - `floor`: 0.3 (matches the current static `PLAIN_EMISSIVE_INTENSITY` — the trough sits at today's brightness; the pulse adds light on top, never below)
  - `emissiveTint`: `[1.0, 0.95, 0.85]` (neutral warm-white — does not shift hue, just brightens)
- Phase desync stays driven by `phaseFromId(id)`, so the twenty-two planets breathe out of unison.
- The current `PULSE_FLOOR = 0.5` magic constant in `planetAnimation.ts` becomes a per-pulse `floor` field. Active-capable planets get `floor: 0.5` written explicitly into their existing entries. The constant is deleted.

## Type changes

### `PlanetLook` — drop `plain`, lift pulse to mandatory

```typescript
// before
type PlanetLook =
  | { readonly kind: 'plain' }
  | { readonly kind: 'effects'; readonly pulse: PulseSpec; readonly rim: RimSpec };

// after
type PlanetLook =
  | { readonly kind: 'body_only'; readonly pulse: PulseSpec }
  | { readonly kind: 'body_and_rim'; readonly pulse: PulseSpec; readonly rim: RimSpec };
```

- `pulse` is mandatory on every variant. The "no pulse at all" state is unrepresentable; the type itself encodes Option B.
- `body_and_rim` is the active-capable variant. `body_only` is everything else.
- No optional fields. No discriminator-without-payload. Iron Law 2 + Iron Law 3.

### `PulseSpec` — gain `floor`

```typescript
// before
type PulseSpec = {
  readonly amplitude: number;
  readonly frequencyHz: number;
  readonly emissiveTint: readonly [number, number, number];
};

// after
type PulseSpec = {
  readonly amplitude: number;
  readonly frequencyHz: number;
  readonly floor: number;
  readonly emissiveTint: readonly [number, number, number];
};
```

- `floor` makes the per-planet brightness baseline explicit and removes the `PULSE_FLOOR` magic constant + the `PLAIN_EMISSIVE_INTENSITY` branch in `cloneAndDress`.
- Active-capable planets: `floor: 0.5` (preserves current behavior exactly).
- Default body-only planets: `floor: 0.3` (preserves the prior static intensity as the trough).

### `PlanetVisualPlan` — fold `plain` into `no_body`, no outline field

```typescript
// before
type PlanetVisualPlan =
  | { kind: 'plain'; scene: Object3D }
  | { kind: 'effects'; scene; atmosphere; pulse; standardMaterials };

// after
type PlanetVisualPlan =
  | { readonly kind: 'no_body'; readonly scene: Object3D }
  | {
      readonly kind: 'body_only';
      readonly scene: Object3D;
      readonly pulse: PulseSpec;
      readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
    }
  | {
      readonly kind: 'body_and_rim';
      readonly scene: Object3D;
      readonly pulse: PulseSpec;
      readonly atmosphere: AtmospherePlan;
      readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
    };
```

- `no_body` is the degenerate-GLTF fallback (no extracted body mesh). Same behavior as today's `plain` fallback when `extraction.kind === 'no_body'` or no standard materials: render the scene, no effects.
- The outline mesh is **not** held in the plan. It is attached as a child of the body mesh during `buildVisualPlan` and never referenced again — no per-frame state, no uniforms, no scaling. The scene graph owns it; Three.js GC cleans it when the parent is disposed. Mirroring the atmosphere's "kept-in-plan" shape would be dead weight — the rim is kept because its uniforms update every frame; the outline has nothing to update.
- `body_and_rim` adds `atmosphere` on top of the `body_only` shape. No optional atmosphere. Iron Law 2 + Iron Law 3.

## Behavior changes

### `cloneAndDress` (`planetVisualPlan.ts`)

- Drop the `look.kind === 'plain'` branch and the `PLAIN_EMISSIVE_INTENSITY` constant.
- Every body now reads `look.pulse.emissiveTint`, sets `material.emissive = pulseTint`, `material.emissiveIntensity = 0`. The animation drives intensity every frame for every planet.

### `buildVisualPlan` (`planetVisualPlan.ts`)

- If `extraction.kind === 'no_body'` or `materials.length === 0`: return `{ kind: 'no_body', scene }`.
- Otherwise, call `attachOutline(body)` — attaches a shell mesh as a child of the body. No return value.
- If `look.kind === 'body_only'`: return `{ kind: 'body_only', scene, pulse, standardMaterials }`.
- If `look.kind === 'body_and_rim'`: also call `attachAtmosphere(body, rim, phase)` (existing code path) and return `{ kind: 'body_and_rim', scene, pulse, atmosphere, standardMaterials }`.

A new `attachOutline(body)` helper sits next to `attachAtmosphere(body, rim, phase)`. Both clone body geometry, smooth vertex normals, re-center, attach as a child mesh. Shared cloning extracted into a `cloneShellGeometry(body)` helper if both call sites end up identical; otherwise inline.

### `animatePlan` (`planetAnimation.ts`)

```typescript
export const animatePlan = (plan, time, phase, activationFactor) => {
  if (plan.kind === 'no_body') return;
  animatePulse(plan.standardMaterials, plan.pulse, time, phase);
  if (plan.kind === 'body_only') return;
  animateAtmosphere(plan.atmosphere, time, phase, activationFactor);
};
```

- `animatePulse` reads `pulse.floor` instead of the module-level `PULSE_FLOOR` constant.
- Outline never animates — no entry in `animatePlan`.
- `animateAtmosphere` is the existing rim animation logic, extracted from the current inline block for clarity (optional refactor; not required for the change).

### `resolvePlanetLook` (`planetAssets.ts`)

- Default fallback for unconfigured asset ids changes from `{ kind: 'plain' }` to the new `DEFAULT_BODY_ONLY` constant (a `body_only` look with the soft default pulse).
- The six explicit entries become `kind: 'body_and_rim'` and each gains `floor: 0.5` inside its `pulse` to match current behavior.

## Files touched

- `src/features/scene/services/renderer/planetTypes.ts` — `PlanetLook`, `PulseSpec`, `PlanetVisualPlan` shape changes.
- `src/features/scene/services/renderer/planetAssets.ts` — `PLANET_LOOK` config, `DEFAULT_BODY_ONLY`, `resolvePlanetLook` fallback.
- `src/features/scene/services/renderer/planetVisualPlan.ts` — `cloneAndDress` (drop plain branch), `buildVisualPlan` (attach outline, new variants), new exported `attachOutline` helper, delete `PLAIN_EMISSIVE_INTENSITY`.
- `src/features/scene/services/renderer/planetAnimation.ts` — three-variant dispatch on `plan.kind`, read `pulse.floor` instead of `PULSE_FLOOR` constant, delete `PULSE_FLOOR`.
- `src/features/scene/components/CompanyInfoPanel/PlanetPreview.tsx` — collapse the local `DressedScene` discriminated union to a single record (every PlanetLook variant now carries a pulse, so the `plain | effects` split inside the preview is no longer meaningful), call `attachOutline` on the extracted body so the in-panel preview matches the in-scene rendering, animate pulse unconditionally.
- `src/features/progress/components/ProgressCard/PlanetCanvas.tsx` — same set of edits as `PlanetPreview.tsx`. The duplication between the two preview components is real but out of scope for this change.
- Tests: `Planet.test.tsx` (existing `resolvePlanetLook` assertions on the `plain` variant and on the six `effects` variants get updated). New `planetAnimation.test.ts` (covers `animatePulse` reading `pulse.floor` and `animatePlan` dispatching on the new three-variant union). `usePlanetVisual.test.ts` should not need changes — its scene mock has no traversable mesh, so `extractBody` returns `no_body`, `buildVisualPlan` takes the early-return branch, and `attachOutline` is never called.
- No changes to `Planet.tsx`, `HeadlinePlanet.tsx`, `PipPlanet.tsx`, `planetCollider.ts`, `planetPose.ts`, `planetPreviewFit.ts`, or any wiring/route layer. The new outline mesh is invisible to all of those; pose extraction still targets the body mesh; collider radius is still `body.radius * PLANET_BASE_SCALE`.

## Iron Law audit

1. **Hexagonal.** All changes confined to `services/renderer/` + `types/`. No core changes, no port changes, no widget/route/component changes. Three.js externality stays inside the renderer service layer. ✓
2. **Discriminated unions.** `PlanetLook` is a flat 2-variant union; every variant carries every field it needs and nothing more. `PlanetVisualPlan` is a flat 3-variant union; rim presence is encoded by the discriminator, not by an optional field. ✓
3. **Illegal states unrepresentable.** Cannot have a planet without a pulse. Cannot have a rim without a pulse. Cannot have a `body_and_rim` plan that's missing the atmosphere. The `PULSE_FLOOR` magic constant is replaced by an explicit field — no two callers can disagree on the floor. The outline is universal-by-scene-graph: when a body exists, the helper attaches an outline child to it; there is no "body with no outline" configuration to forget. ✓
4. **Design discipline.** Adds one type variant + one helper, removes one branch in `cloneAndDress`, one module-level constant (`PULSE_FLOOR`), one module-level constant (`PLAIN_EMISSIVE_INTENSITY`), and one variant (`plain`). Adds explicit `floor` to absorb the previously-implicit two-floor system. Every addition deletes a branch or constant; nothing speculative. No flexibility knobs added (outline is uniform across all planets — no per-planet outline config until something demands it). The outline mesh is **not** held in the plan because nothing reads it after attachment — mirroring `AtmospherePlan`'s shape would be dead structure. ✓
5. **No suppressors.** No casts, no `!`, no `??` on lookup, no disables. The fallback in `resolvePlanetLook` already returns a concrete `PlanetLook` (was `{ kind: 'plain' }`, becomes `DEFAULT_BODY_ONLY`); the lookup itself never returns `undefined` after the fold. ✓
6. **Universal cross-layer rule.** No information crosses where it didn't already. `animatePlan` reads from the plan; the plan's structure encodes everything. Component-level `Planet.tsx` still passes through `activationFactor` opaquely. ✓

## Defaults committed (not open questions)

You said "not sure, just make it not too aggressive, not complicated." So this spec commits to:

- **Outline color**: near-black `0x080808` (graphic-stroke style, uniform across the field — not per-planet tinted).
- **Outline opacity**: `0.55`.
- **Outline scale**: `1.025` (2.5% past body radius).
- **Default body-only pulse tint**: `[1.0, 0.95, 0.85]` (neutral warm-white, brightens without shifting hue).

If after seeing it live any of these feel wrong, each is a single-constant tweak.
