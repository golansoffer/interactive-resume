# Planet Cosmetics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Project rule (overrides skill defaults):** Never run `git commit`, `git push`, `git stash`, `git reset`, or `git rebase`. Only the user mutates history. Wherever a step says "Commit", do **not** run the command — leave staged changes for the user, or skip the commit and continue. Read-only git (`git status`, `git diff`, `git log`) is fine. Never create worktrees / side branches.

**Goal:** Add two subtle cosmetic moves to the planet rendering — a universal silhouette outline (always-on, near-black, slightly-inflated BackSide shell) and a universal gentle emissive pulse (every planet breathes, not just the active-capable ones) — without touching the active-mode rim atmosphere.

**Architecture:** Pure-renderer change. All edits live in `src/features/scene/services/renderer/` + the two preview components that consume `cloneAndDress` / `animatePulse` directly. The `PlanetLook` discriminated union is restructured so every variant carries a `pulse` (no more `plain`), and `PulseSpec` gains an explicit `floor` field that replaces the `PULSE_FLOOR` / `PLAIN_EMISSIVE_INTENSITY` module-level constants. The outline is attached to the body mesh by a new `attachOutline` helper invoked from `buildVisualPlan` and from each preview component; the outline mesh is **not** held in the visual plan because nothing reads it after attachment.

**Tech Stack:** TypeScript, React 19, three.js, @react-three/fiber, @react-three/drei, vitest, oxlint, pnpm.

**Reference spec:** `docs/superpowers/specs/2026-05-23-planet-cosmetics-design.md`

---

## File Map

**Modified:**
- `src/features/scene/services/renderer/planetTypes.ts` — `PlanetLook`, `PulseSpec`, `PlanetVisualPlan` reshapes.
- `src/features/scene/services/renderer/planetAssets.ts` — `PLANET_LOOK` entries gain `floor`, `resolvePlanetLook` fallback returns `DEFAULT_BODY_ONLY`, header comment updated.
- `src/features/scene/services/renderer/planetVisualPlan.ts` — drop `PLAIN_EMISSIVE_INTENSITY`, drop `look.kind === 'plain'` branch in `cloneAndDress`, new `attachOutline` helper, `buildVisualPlan` returns new variants and always attaches an outline when a body exists.
- `src/features/scene/services/renderer/planetAnimation.ts` — drop `PULSE_FLOOR` constant, read `pulse.floor`, dispatch `animatePlan` on three variants (`no_body` / `body_only` / `body_and_rim`).
- `src/features/scene/components/CompanyInfoPanel/PlanetPreview.tsx` — collapse local `DressedScene` union to a single shape (every planet has a pulse), call `attachOutline` on the body so the preview matches the in-scene rendering, animate pulse unconditionally.
- `src/features/progress/components/ProgressCard/PlanetCanvas.tsx` — same shape changes as `PlanetPreview.tsx` (file duplicates the same pattern).
- `src/features/scene/components/Scene/Planet.test.tsx` — replace `plain` assertions with `body_only` / `body_and_rim`, add `floor` assertions on existing entries.
- `src/features/scene/components/Scene/usePlanetVisual.test.ts` — no behavioral assertions on plan variant, but `mockScene.traverse` may need a body-mesh mock once the outline path triggers (verify the hook still returns a plan).

**Created:**
- `src/features/scene/services/renderer/planetAnimation.test.ts` — tests for `animatePulse` reading `pulse.floor` and for `animatePlan` dispatch on each variant.
- `src/features/scene/services/renderer/attachOutline.test.ts` *(only if `attachOutline` is split into its own file — see Task 5; otherwise tests live in a new `planetVisualPlan.test.ts`)*.

**Untouched (verified):**
- `src/features/scene/components/Scene/Planet.tsx` — props and lifecycle don't change.
- `src/features/scene/services/renderer/planetAtmosphereMaterial.ts` — active rim untouched.
- `src/features/scene/services/renderer/planetPose.ts`, `planetCollider.ts`, `planetPreviewFit.ts` — body extraction unchanged.

---

## Test Strategy

- Unit tests for pure functions (`resolvePlanetLook`, `animatePulse`, `animatePlan`, `attachOutline`) using vitest + three.js primitives (no mocks where a real `Mesh` / `MeshStandardMaterial` works).
- Existing `Planet.test.tsx` assertions on `resolvePlanetLook` get updated, not replaced — same coverage of jupiter_b / saturn_b / mars_b / earth_b / venus_b / uranus_b plus the previously-`plain` defaults.
- Component-level previews (`PlanetPreview.tsx`, `PlanetCanvas.tsx`) currently have no unit tests; we don't add new ones — the existing `Planet.test.tsx` + `usePlanetVisual.test.ts` cover the integration surface for the scene, and visual verification covers the previews.
- After all tasks, a manual smoke pass in the browser confirms outline visibility, pulse aliveness on previously-static planets, and that the active rim still triggers correctly on hover/proximity for the six active-capable planets.

Commands the engineer will run repeatedly:
- `pnpm test -- <test-file-glob>` — run a focused test
- `pnpm test` — run all tests
- `pnpm typecheck` — TypeScript build (no emit, project-references)
- `pnpm lint` — oxlint (also enforces the `pnpm lint:suppressors` scan when present; if a build-failing suppressor lint exists separately, run it too)
- `pnpm dev` — manual visual verification

---

## Task 1 — Reshape `PulseSpec`, `PlanetLook`, `PlanetVisualPlan` types

**Files:**
- Modify: `src/features/scene/services/renderer/planetTypes.ts`

This task is types-only. It will deliberately break the rest of the codebase (compile errors in `planetVisualPlan.ts`, `planetAnimation.ts`, `planetAssets.ts`, the two preview components, and `Planet.test.tsx`). Each subsequent task repairs one consumer at a time. Do not attempt to `pnpm typecheck` clean until Task 8.

- [ ] **Step 1.1: Add `floor` to `PulseSpec`**

Open `src/features/scene/services/renderer/planetTypes.ts`. Find:

```typescript
export type PulseSpec = {
  readonly amplitude: number;
  readonly frequencyHz: number;
  readonly emissiveTint: readonly [number, number, number];
};
```

Replace with:

```typescript
export type PulseSpec = {
  readonly amplitude: number;
  readonly frequencyHz: number;
  // Emissive intensity floor — the trough of the pulse. Per-planet because
  // active-capable planets sit visibly brighter at rest than body-only
  // planets; folding both into one type kills the prior module-level
  // PULSE_FLOOR / PLAIN_EMISSIVE_INTENSITY split.
  readonly floor: number;
  readonly emissiveTint: readonly [number, number, number];
};
```

- [ ] **Step 1.2: Reshape `PlanetLook`**

Find:

```typescript
export type PlanetLook =
  | { readonly kind: 'plain' }
  | { readonly kind: 'effects'; readonly pulse: PulseSpec; readonly rim: RimSpec };
```

Replace with:

```typescript
// Every planet has a body pulse — baseline aliveness. Some are also
// "active-capable" and additionally carry a rim spec (the fresnel
// atmosphere that fades in on proximity). The discriminator encodes rim
// presence; there is no optional rim field.
export type PlanetLook =
  | { readonly kind: 'body_only'; readonly pulse: PulseSpec }
  | { readonly kind: 'body_and_rim'; readonly pulse: PulseSpec; readonly rim: RimSpec };
```

Also update the comment block immediately above this type (the one that mentions `PlanetLook` resolving to `plain`) to match.

- [ ] **Step 1.3: Reshape `PlanetVisualPlan`**

Find:

```typescript
export type PlanetVisualPlan =
  | { readonly kind: 'plain'; readonly scene: Object3D }
  | {
      readonly kind: 'effects';
      readonly scene: Object3D;
      readonly atmosphere: AtmospherePlan;
      readonly pulse: PulseSpec;
      readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
    };
```

Replace with:

```typescript
// `no_body` is the degenerate fallback when extractBody could not pick a
// body mesh out of the GLTF (no spherical candidate). In that case
// nothing animates, no outline, no atmosphere — just the raw cloned
// scene. For every real planet asset shipped here the plan is body_only
// or body_and_rim. The outline mesh is attached to the body during
// buildVisualPlan as a side effect and never referenced again; it is
// intentionally not stored in the plan.
export type PlanetVisualPlan =
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

- [ ] **Step 1.4: Verify the file builds in isolation**

Run: `pnpm typecheck`

Expected: many errors in `planetVisualPlan.ts`, `planetAnimation.ts`, `planetAssets.ts`, `PlanetPreview.tsx`, `PlanetCanvas.tsx`, `Planet.test.tsx` — all of them about the missing `floor` field, `kind: 'plain'`, `kind: 'effects'`, etc. **This is expected.** Do not try to fix anything yet. Errors confined to the files in the "File Map" above means the type change has the intended blast radius.

- [ ] **Step 1.5: Commit (user runs)**

Tell the user: "Types reshape staged. To commit, run:"

```bash
git add src/features/scene/services/renderer/planetTypes.ts
git commit -m "refactor(scene): reshape PlanetLook/PulseSpec/PlanetVisualPlan for universal pulse + outline"
```

Do **not** run `git commit` yourself.

---

## Task 2 — Update `planetAssets.ts` — `PLANET_LOOK` entries, `DEFAULT_BODY_ONLY`, `resolvePlanetLook` fallback

**Files:**
- Modify: `src/features/scene/services/renderer/planetAssets.ts`

- [ ] **Step 2.1: Update the six existing `PLANET_LOOK` entries**

Open `src/features/scene/services/renderer/planetAssets.ts`. Each of the six entries (`jupiter_b`, `saturn_b`, `mars_b`, `earth_b`, `venus_b`, `uranus_b`) currently looks like:

```typescript
jupiter_b: {
  kind: 'effects',
  pulse: { amplitude: 0.65, frequencyHz: 0.13, emissiveTint: [1.0, 0.58, 0.22] },
  rim: { ... },
},
```

For **each** of the six, change `kind: 'effects'` to `kind: 'body_and_rim'` and add `floor: 0.5` inside the `pulse` object (preserving the rest exactly):

```typescript
jupiter_b: {
  kind: 'body_and_rim',
  pulse: { amplitude: 0.65, frequencyHz: 0.13, floor: 0.5, emissiveTint: [1.0, 0.58, 0.22] },
  rim: { ... },
},
```

Apply the same two edits to all six entries. The `rim` field is untouched.

- [ ] **Step 2.2: Add `DEFAULT_BODY_ONLY` and update the fallback**

In the same file, immediately above `export const resolvePlanetLook`, add:

```typescript
// Default look for every planet asset that doesn't carry a configured rim.
// Provides the body pulse only — gentle, slow, low-amplitude, neutral
// warm-white tint that brightens without shifting the colorsheet's hue.
// Phase desync between planets is handled at consumer level (phaseFromId).
// Floor 0.3 matches the prior static PLAIN_EMISSIVE_INTENSITY so the pulse
// trough sits at today's visible brightness and the peak only adds light.
const DEFAULT_BODY_ONLY: PlanetLook = {
  kind: 'body_only',
  pulse: {
    amplitude: 0.12,
    frequencyHz: 0.05,
    floor: 0.3,
    emissiveTint: [1.0, 0.95, 0.85],
  },
};
```

Then update the fallback in `resolvePlanetLook` from:

```typescript
export const resolvePlanetLook = (assetId: PlanetAssetId): PlanetLook => {
  const look = PLANET_LOOK[assetId];
  if (look === undefined) return { kind: 'plain' };
  return look;
};
```

to:

```typescript
export const resolvePlanetLook = (assetId: PlanetAssetId): PlanetLook => {
  const look = PLANET_LOOK[assetId];
  if (look === undefined) return DEFAULT_BODY_ONLY;
  return look;
};
```

- [ ] **Step 2.3: Update the file header comment**

Find the multi-line comment that begins `// Per-asset look. Each visible planet carries the full effect bundle…` (right above `const PLANET_LOOK`). Replace it with:

```typescript
// Per-asset look. The six explicit entries are the active-capable planets —
// each carries a body pulse (baseline aliveness, always on) and a rim
// (fresnel atmosphere gated on activation). All other asset ids resolve to
// DEFAULT_BODY_ONLY via resolvePlanetLook: same pulse-driven aliveness, no
// rim. Rim tints span the wheel (cyan / gold / red-orange / magenta /
// violet); pulse emissive tints match each planet's character so the
// body's "alive" glow reads as its own color, not a generic warm light.
```

- [ ] **Step 2.4: Typecheck the file**

Run: `pnpm typecheck`

Expected: the errors in `planetAssets.ts` are gone. Errors remain in `planetVisualPlan.ts`, `planetAnimation.ts`, `PlanetPreview.tsx`, `PlanetCanvas.tsx`, `Planet.test.tsx`. That's fine.

- [ ] **Step 2.5: Commit (user runs)**

```bash
git add src/features/scene/services/renderer/planetAssets.ts
git commit -m "refactor(scene): PLANET_LOOK uses body_and_rim variant + per-pulse floor; DEFAULT_BODY_ONLY for unconfigured assets"
```

---

## Task 3 — Drop `PLAIN_EMISSIVE_INTENSITY` and the `plain` branch in `cloneAndDress`

**Files:**
- Modify: `src/features/scene/services/renderer/planetVisualPlan.ts`

- [ ] **Step 3.1: Delete `PLAIN_EMISSIVE_INTENSITY` and its comment**

Open `src/features/scene/services/renderer/planetVisualPlan.ts`. Delete this entire block (lines ~34–42, the comment plus the constant):

```typescript
// Static emissive contribution for plain-look bodies. Effects-look bodies
// pulse between [PULSE_FLOOR, PULSE_FLOOR + amplitude] (PULSE_FLOOR=0.5)
// with a tinted emissive that attenuates the colorsheet sample; without
// this floor, plain bodies sat at intensity=0 and rendered substantially
// darker than effects bodies even at their pulse trough — the moon and
// the plain filler planets read as meteors, not bodies. A neutral-white
// emissive at this intensity keeps the colorsheet's authored color
// visible while staying below an effects body's tinted baseline so the
// activation pulse still reads as a distinct boost.
const PLAIN_EMISSIVE_INTENSITY = 0.3;
```

- [ ] **Step 3.2: Rewrite the `if (look.kind === 'effects')` block in `cloneAndDress`**

Find the inner block in `cloneAndDress`:

```typescript
    if (look.kind === 'effects') {
      const [r, g, b] = look.pulse.emissiveTint;
      m.emissive = new Color(r, g, b);
      m.emissiveIntensity = 0;
    } else {
      m.emissive = new Color(1, 1, 1);
      m.emissiveIntensity = PLAIN_EMISSIVE_INTENSITY;
    }
```

Replace with:

```typescript
    // Every PlanetLook variant carries a pulse — the body emissive is
    // always tinted by pulse.emissiveTint, and intensity is driven every
    // frame by animatePulse. Initial intensity 0 is a placeholder that
    // animatePulse overwrites on the first frame.
    const [r, g, b] = look.pulse.emissiveTint;
    m.emissive = new Color(r, g, b);
    m.emissiveIntensity = 0;
```

- [ ] **Step 3.3: Typecheck**

Run: `pnpm typecheck`

Expected: errors in `cloneAndDress` gone. `buildVisualPlan` still errors (uses `kind: 'plain'` / `kind: 'effects'`). Other consumer files still error.

- [ ] **Step 3.4: Commit (user runs)**

```bash
git add src/features/scene/services/renderer/planetVisualPlan.ts
git commit -m "refactor(scene): cloneAndDress always tints emissive from pulse; drop PLAIN_EMISSIVE_INTENSITY"
```

---

## Task 4 — Add `attachOutline` helper + integrate in `buildVisualPlan`

**Files:**
- Modify: `src/features/scene/services/renderer/planetVisualPlan.ts`

- [ ] **Step 4.1: Add imports**

At the top of `planetVisualPlan.ts`, ensure these imports are present (some already are — only add what's missing):

```typescript
import { BackSide, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
```

- [ ] **Step 4.2: Add the outline constants**

Above `const ROTATION_RAD_PER_SEC_BASE` (existing constants block), add:

```typescript
// Silhouette outline. A slightly-inflated shell of the body geometry,
// rendered with BackSide so the body's own depth occludes everything
// except the rim around the silhouette — classic NPR outline. Always-on,
// never animated. Sits at radius 1.025 (well inside the active rim's
// 1.12–1.14) so it reads as the planet's own edge, not a halo. Additive
// active rim brightens over it naturally; outline reads clean at rest.
const OUTLINE_SCALE = 1.025;
const OUTLINE_OPACITY = 0.55;
const OUTLINE_COLOR = 0x080808;
```

- [ ] **Step 4.3: Add the `attachOutline` helper**

Place this helper directly above `attachAtmosphere` (or below if the file structure prefers):

```typescript
// Attaches an outline shell mesh as a child of the body. Clones the body
// geometry, smooths vertex normals (kills flat-shading silhouette
// discontinuities the outline would otherwise expose), and re-centers on
// the body's bounding-sphere origin so uniform scaling expands the rim
// evenly. The outline mesh is intentionally not returned — nothing reads
// it after attachment; the scene graph owns it for the lifetime of the
// body, and animatePlan never touches it.
export const attachOutline = (body: Mesh): void => {
  const sphere = body.geometry.boundingSphere;
  if (sphere === null) {
    throw new Error('attachOutline: body geometry has no bounding sphere');
  }
  const geometry = body.geometry.clone();
  geometry.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
  geometry.computeVertexNormals();
  const material = new MeshBasicMaterial({
    color: new Color(OUTLINE_COLOR),
    side: BackSide,
    transparent: true,
    opacity: OUTLINE_OPACITY,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.copy(sphere.center);
  mesh.scale.setScalar(OUTLINE_SCALE);
  mesh.renderOrder = 0;
  body.add(mesh);
};
```

Note `export` — the preview components need to call it directly (Task 7).

- [ ] **Step 4.4: Set `renderOrder` on the atmosphere mesh too**

Find the `attachAtmosphere` function. After `mesh.scale.setScalar(rim.scale);`, add a single line so the atmosphere always draws after the outline regardless of camera/distance sort ordering:

```typescript
  mesh.renderOrder = 1;
```

- [ ] **Step 4.5: Rewrite `buildVisualPlan`**

Find the existing function:

```typescript
export const buildVisualPlan = (
  look: PlanetLook,
  cloned: ClonedScene,
  phase: number,
): PlanetVisualPlan => {
  const scene = cloned.scene;
  const mats = cloned.standardMaterials;
  if (look.kind === 'plain') return { kind: 'plain', scene };
  if (cloned.extraction.kind === 'no_body' || mats.length === 0) {
    return { kind: 'plain', scene };
  }
  return {
    kind: 'effects',
    scene,
    atmosphere: attachAtmosphere(cloned.extraction.mesh, look.rim, phase),
    pulse: look.pulse,
    standardMaterials: mats,
  };
};
```

Replace with:

```typescript
export const buildVisualPlan = (
  look: PlanetLook,
  cloned: ClonedScene,
  phase: number,
): PlanetVisualPlan => {
  const scene = cloned.scene;
  const mats = cloned.standardMaterials;
  if (cloned.extraction.kind === 'no_body' || mats.length === 0) {
    return { kind: 'no_body', scene };
  }
  attachOutline(cloned.extraction.mesh);
  if (look.kind === 'body_only') {
    return { kind: 'body_only', scene, pulse: look.pulse, standardMaterials: mats };
  }
  return {
    kind: 'body_and_rim',
    scene,
    pulse: look.pulse,
    atmosphere: attachAtmosphere(cloned.extraction.mesh, look.rim, phase),
    standardMaterials: mats,
  };
};
```

- [ ] **Step 4.6: Typecheck the file**

Run: `pnpm typecheck`

Expected: errors in `planetVisualPlan.ts` resolved. Remaining errors in `planetAnimation.ts`, `PlanetPreview.tsx`, `PlanetCanvas.tsx`, `Planet.test.tsx`.

- [ ] **Step 4.7: Commit (user runs)**

```bash
git add src/features/scene/services/renderer/planetVisualPlan.ts
git commit -m "feat(scene): attachOutline helper, buildVisualPlan emits new 3-variant plan"
```

---

## Task 5 — Update `animatePulse` and `animatePlan` to read `pulse.floor` + dispatch new variants

**Files:**
- Modify: `src/features/scene/services/renderer/planetAnimation.ts`

- [ ] **Step 5.1: Delete the `PULSE_FLOOR` constant**

Open `src/features/scene/services/renderer/planetAnimation.ts`. Delete the block:

```typescript
// Body emissive floor. Per-asset `pulse.amplitude` rides on top so the
// effective range is [PULSE_FLOOR, PULSE_FLOOR + amplitude] — the planet
// never dims below this even at the trough of the sine, regardless of activation.
const PULSE_FLOOR = 0.5;
```

- [ ] **Step 5.2: Update `animatePulse` to use `pulse.floor`**

Find:

```typescript
export const animatePulse = (
  materials: ReadonlyArray<MeshStandardMaterial>,
  pulse: PulseSpec,
  time: number,
  phase: number,
): void => {
  const pulseT = (Math.sin(time * pulse.frequencyHz * TWO_PI + phase) + 1) * 0.5;
  const intensity = PULSE_FLOOR + pulse.amplitude * pulseT;
  for (const m of materials) m.emissiveIntensity = intensity;
};
```

Replace the relevant line so `pulse.floor` is the source of the floor:

```typescript
export const animatePulse = (
  materials: ReadonlyArray<MeshStandardMaterial>,
  pulse: PulseSpec,
  time: number,
  phase: number,
): void => {
  const pulseT = (Math.sin(time * pulse.frequencyHz * TWO_PI + phase) + 1) * 0.5;
  const intensity = pulse.floor + pulse.amplitude * pulseT;
  for (const m of materials) m.emissiveIntensity = intensity;
};
```

- [ ] **Step 5.3: Rewrite `animatePlan` to dispatch on the new variants**

Find the entire `animatePlan` function and replace with:

```typescript
// Applies per-frame mutations to the visual plan:
// - no_body: nothing animates (degenerate fallback).
// - body_only: body pulse only.
// - body_and_rim: body pulse + rim atmosphere (rim opacity, idle breath,
//   shader time, and scale pulse are multiplied by activationFactor so
//   the rim fades in/out on proximity). The outline is never touched.
export const animatePlan = (
  plan: PlanetVisualPlan,
  time: number,
  phase: number,
  activationFactor: number,
): void => {
  if (plan.kind === 'no_body') return;
  animatePulse(plan.standardMaterials, plan.pulse, time, phase);
  if (plan.kind === 'body_only') return;

  const { breath, baseOpacity, opacityUniform, timeUniform, rimMesh, baseScale, scalePulse } =
    plan.atmosphere;
  const breathT = (Math.sin(time * breath.frequencyHz * TWO_PI + phase * 0.6) + 1) * 0.5;
  const breathFactor = 1 - breath.amplitude * 0.5 + breath.amplitude * breathT;
  opacityUniform.value = baseOpacity * breathFactor * activationFactor;
  timeUniform.value = time;
  const scalePulseT =
    (Math.sin(time * scalePulse.frequencyHz * TWO_PI + phase * 1.1) + 1) * 0.5;
  const pulseFactor = 1 + scalePulse.amplitude * scalePulseT * activationFactor;
  rimMesh.scale.setScalar(baseScale * pulseFactor);
};
```

- [ ] **Step 5.4: Typecheck**

Run: `pnpm typecheck`

Expected: errors in `planetAnimation.ts` gone. Remaining errors in `PlanetPreview.tsx`, `PlanetCanvas.tsx`, `Planet.test.tsx`.

- [ ] **Step 5.5: Commit (user runs)**

```bash
git add src/features/scene/services/renderer/planetAnimation.ts
git commit -m "refactor(scene): animatePulse reads pulse.floor; animatePlan dispatches on 3 variants"
```

---

## Task 6 — Write `planetAnimation.test.ts` (new test file)

**Files:**
- Create: `src/features/scene/services/renderer/planetAnimation.test.ts`

This task adds coverage for the floor-reading behavior and the three-variant dispatch — the constants we removed were never tested directly, so we add tests to lock the new contract in place.

- [ ] **Step 6.1: Create the test file**

Create `src/features/scene/services/renderer/planetAnimation.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest';
import {
  AdditiveBlending,
  BoxGeometry,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  Vector3,
} from 'three';
import { animatePulse, animatePlan } from './planetAnimation';
import type {
  AtmospherePlan,
  PlanetVisualPlan,
  PulseSpec,
} from './planetTypes';

const makePulse = (overrides: Partial<PulseSpec> = {}): PulseSpec => ({
  amplitude: 0.6,
  frequencyHz: 0.1,
  floor: 0.4,
  emissiveTint: [1, 1, 1],
  ...overrides,
});

const makeMaterial = (): MeshStandardMaterial => {
  const m = new MeshStandardMaterial();
  m.emissiveIntensity = -1; // sentinel so we can verify it gets overwritten
  return m;
};

const makeAtmospherePlan = (): AtmospherePlan => {
  const opacityUniform = { value: -1 };
  const timeUniform = { value: -1 };
  const rimMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  return {
    opacityUniform,
    timeUniform,
    baseOpacity: 0.8,
    breath: { amplitude: 0.3, frequencyHz: 0.1 },
    rimMesh,
    baseScale: 1.12,
    scalePulse: { amplitude: 0.1, frequencyHz: 0.4 },
  };
};

describe('animatePulse — uses pulse.floor as the trough', () => {
  it('writes pulse.floor + amplitude * 0 (≈ pulse.floor) at the sine trough', () => {
    const mat = makeMaterial();
    const pulse = makePulse({ floor: 0.3, amplitude: 0.5, frequencyHz: 1 });
    // sin(time * 2π) is 0 at time=0; (sin+1)/2 = 0.5, so intensity = floor + amp*0.5
    animatePulse([mat], pulse, 0, 0);
    expect(mat.emissiveIntensity).toBeCloseTo(0.3 + 0.5 * 0.5, 6);
  });

  it('drives every material in the array', () => {
    const m1 = makeMaterial();
    const m2 = makeMaterial();
    const pulse = makePulse({ floor: 0.5, amplitude: 0.2, frequencyHz: 1 });
    animatePulse([m1, m2], pulse, 0.25, 0); // sin(0.5π) = 1 → t=1 → intensity = floor + amp
    expect(m1.emissiveIntensity).toBeCloseTo(0.7, 6);
    expect(m2.emissiveIntensity).toBeCloseTo(0.7, 6);
  });

  it('reads floor from the pulse, not from a module constant', () => {
    const mat = makeMaterial();
    const pulse = makePulse({ floor: 0.05, amplitude: 0, frequencyHz: 1 });
    animatePulse([mat], pulse, 0, 0);
    // amplitude=0 means intensity = floor exactly, regardless of pulseT
    expect(mat.emissiveIntensity).toBeCloseTo(0.05, 6);
  });
});

describe('animatePlan — variant dispatch', () => {
  it('no_body: returns without touching anything', () => {
    const plan: PlanetVisualPlan = { kind: 'no_body', scene: new Object3D() };
    // No assertion needed beyond "does not throw". The test passes by reaching this line.
    expect(() => animatePlan(plan, 0, 0, 1)).not.toThrow();
  });

  it('body_only: animates pulse on materials, leaves nothing else to touch', () => {
    const mat = makeMaterial();
    const plan: PlanetVisualPlan = {
      kind: 'body_only',
      scene: new Object3D(),
      pulse: makePulse({ floor: 0.3, amplitude: 0, frequencyHz: 1 }),
      standardMaterials: [mat],
    };
    animatePlan(plan, 0, 0, 0); // activationFactor is irrelevant for body_only
    expect(mat.emissiveIntensity).toBeCloseTo(0.3, 6);
  });

  it('body_and_rim with activationFactor=0: animates pulse and zeros rim opacity', () => {
    const mat = makeMaterial();
    const atmosphere = makeAtmospherePlan();
    const plan: PlanetVisualPlan = {
      kind: 'body_and_rim',
      scene: new Object3D(),
      pulse: makePulse({ floor: 0.5, amplitude: 0, frequencyHz: 1 }),
      atmosphere,
      standardMaterials: [mat],
    };
    animatePlan(plan, 0, 0, 0);
    expect(mat.emissiveIntensity).toBeCloseTo(0.5, 6);
    expect(atmosphere.opacityUniform.value).toBeCloseTo(0, 6);
  });

  it('body_and_rim with activationFactor=1: opacity scales with breath, time uniform written', () => {
    const mat = makeMaterial();
    const atmosphere = makeAtmospherePlan();
    const plan: PlanetVisualPlan = {
      kind: 'body_and_rim',
      scene: new Object3D(),
      pulse: makePulse(),
      atmosphere,
      standardMaterials: [mat],
    };
    animatePlan(plan, 12.5, 0.3, 1);
    expect(atmosphere.opacityUniform.value).toBeGreaterThan(0);
    expect(atmosphere.timeUniform.value).toBeCloseTo(12.5, 6);
  });
});
```

- [ ] **Step 6.2: Run the new test file**

Run: `pnpm test -- planetAnimation.test`

Expected: all tests pass. If any fails:
- `Cannot find module './planetAnimation'` → check relative path.
- Floor mismatch → re-check Step 5.2 substitution.
- `animatePlan is not a function` → confirm Step 5.3 didn't accidentally rename it.

- [ ] **Step 6.3: Commit (user runs)**

```bash
git add src/features/scene/services/renderer/planetAnimation.test.ts
git commit -m "test(scene): unit tests for animatePulse floor + animatePlan dispatch"
```

---

## Task 7 — Update `PlanetPreview.tsx` and `PlanetCanvas.tsx` to consume the new shape and attach outline

**Files:**
- Modify: `src/features/scene/components/CompanyInfoPanel/PlanetPreview.tsx`
- Modify: `src/features/progress/components/ProgressCard/PlanetCanvas.tsx`

Both files have the identical local `DressedScene` discriminated union (`plain | effects`). After the type reshape, `plain` is gone — every planet has a pulse. Collapse the union to a single shape and call `attachOutline` so the previews match the in-scene rendering.

The duplication between the two files is real, but **out of scope** for this change. Keep edits localized.

- [ ] **Step 7.1: Edit `PlanetPreview.tsx`**

Open `src/features/scene/components/CompanyInfoPanel/PlanetPreview.tsx`.

At the imports, add `attachOutline`:

```typescript
import { cloneAndDress, attachOutline } from '../../services/renderer/planetVisualPlan';
```

(If the existing `import { cloneAndDress }` is on its own line, modify it to include `attachOutline`.)

Replace the local `DressedScene` union with a single record (no discriminant — every variant identical):

```typescript
type DressedScene = {
  readonly scene: Object3D;
  readonly materials: ReadonlyArray<MeshStandardMaterial>;
  readonly pulse: PulseSpec;
  readonly pose: PlanetPose;
  readonly fit: PlanetPreviewFit;
};
```

Replace the body of `useDressedScene`:

```typescript
const useDressedScene = (assetId: PlanetAssetId): DressedScene => {
  const { scene } = useGLTF(assetUrl(PLANET_PATHS[assetId]));
  const colorsheet = useTexture(assetUrl(COLORSHEET_PATH));
  return useMemo(() => {
    configureColorsheet(colorsheet);
    const look = resolvePlanetLook(assetId);
    const dressed = cloneAndDress(scene, colorsheet, look);
    const pose = planetPoseFor(dressed.extraction);
    const fit = computePlanetPreviewFit(dressed.scene, pose.alignQuaternion);
    if (dressed.extraction.kind !== 'no_body') {
      attachOutline(dressed.extraction.mesh);
    }
    return {
      scene: dressed.scene,
      materials: dressed.standardMaterials,
      pulse: look.pulse,
      pose,
      fit,
    };
  }, [scene, colorsheet, assetId]);
};
```

Simplify `usePreviewFrame` — every dressed scene now has materials + pulse, no `kind` check needed:

```typescript
const usePreviewFrame = (
  groupRef: RefObject<Group | null>,
  dressed: DressedScene,
  phase: number,
): void => {
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y += ROTATION_RATE_RAD_PER_SEC * delta;
    animatePulse(dressed.materials, dressed.pulse, state.clock.elapsedTime, phase);
  });
};
```

- [ ] **Step 7.2: Edit `PlanetCanvas.tsx`**

Open `src/features/progress/components/ProgressCard/PlanetCanvas.tsx`. Apply the exact same set of edits as Step 7.1:

1. Import `attachOutline` from `'../../../scene/services/renderer/planetVisualPlan'` (note the relative path — three levels up from `progress/components/ProgressCard/`).
2. Collapse `DressedScene` to a single record.
3. Update `useDressedScene` to attach the outline and return the single shape.
4. Simplify `useRotatingFrame` to call `animatePulse` unconditionally.

The function names differ (`usePreviewFrame` vs `useRotatingFrame`, `PlanetScene` vs `RotatingPlanetScene`); do not rename anything. Only the union → record collapse, `attachOutline` call, and the unconditional `animatePulse` invocation change.

- [ ] **Step 7.3: Typecheck**

Run: `pnpm typecheck`

Expected: no errors in either preview file. `Planet.test.tsx` is the only remaining failure source.

- [ ] **Step 7.4: Commit (user runs)**

```bash
git add src/features/scene/components/CompanyInfoPanel/PlanetPreview.tsx \
        src/features/progress/components/ProgressCard/PlanetCanvas.tsx
git commit -m "refactor(scene,progress): previews collapse to single-variant dressed scene + attach outline"
```

---

## Task 8 — Update `Planet.test.tsx`

**Files:**
- Modify: `src/features/scene/components/Scene/Planet.test.tsx`

- [ ] **Step 8.1: Update each `resolvePlanetLook` assertion**

Open `src/features/scene/components/Scene/Planet.test.tsx`.

For each of the four `resolvePlanetLook` tests on `jupiter_b`, `saturn_b`, `mars_b`, and `earth_b`, replace every `look.kind === 'effects'` narrow guard with `look.kind === 'body_and_rim'`, every `expect(look.kind).toBe('effects')` with `expect(look.kind).toBe('body_and_rim')`, and every literal `'expected effects variant'` message with `'expected body_and_rim variant'`. Inside each test, add one extra assertion after the existing `look.pulse.*` checks:

```typescript
    expect(look.pulse.floor).toBe(0.5);
```

For the `mars_b` test specifically, the `expect(look.pulse.frequencyHz).toBeCloseTo(0.17);` / `expect(look.pulse.amplitude).toBeCloseTo(0.68);` lines stay as-is.

- [ ] **Step 8.2: Replace the `plain` fallback test**

Find:

```typescript
  it('returns plain for an unconfigured asset id', () => {
    expect(resolvePlanetLook('mercury_a')).toEqual({ kind: 'plain' });
    expect(resolvePlanetLook('neptune_b')).toEqual({ kind: 'plain' });
    expect(resolvePlanetLook('sun_a')).toEqual({ kind: 'plain' });
  });
```

Replace with:

```typescript
  it('returns DEFAULT_BODY_ONLY for any unconfigured asset id (every planet has a pulse)', () => {
    for (const id of ['mercury_a', 'neptune_b', 'sun_a'] as const) {
      const look = resolvePlanetLook(id);
      expect(look.kind).toBe('body_only');
      if (look.kind !== 'body_only') throw new Error('expected body_only variant');
      expect(look.pulse.amplitude).toBe(0.12);
      expect(look.pulse.frequencyHz).toBe(0.05);
      expect(look.pulse.floor).toBe(0.3);
      expect(look.pulse.emissiveTint).toEqual([1.0, 0.95, 0.85]);
    }
  });
```

- [ ] **Step 8.3: Run the test file**

Run: `pnpm test -- Planet.test`

Expected: all `resolvePlanetLook` tests pass; existing `extractBody` tests untouched and still pass.

- [ ] **Step 8.4: Commit (user runs)**

```bash
git add src/features/scene/components/Scene/Planet.test.tsx
git commit -m "test(scene): update resolvePlanetLook assertions for new PlanetLook variants"
```

---

## Task 9 — Full typecheck + full test + lint pass

**Files:** none (gate task).

- [ ] **Step 9.1: Full typecheck**

Run: `pnpm typecheck`

Expected: zero errors. If anything fails, the issue is in one of the modified files — re-check Tasks 1–8.

- [ ] **Step 9.2: Full test suite**

Run: `pnpm test`

Expected: every test passes. Pay attention to `usePlanetVisual.test.ts` (it mocks the GLTF scene; if the mock has no traversable mesh, the new `attachOutline` call could throw on `body.geometry.boundingSphere`). If it fails:

The mock at the top of `usePlanetVisual.test.ts` returns a `mockScene` whose `traverse` is a no-op — `extractBody` sees zero meshes and returns `{ kind: 'no_body' }`. `buildVisualPlan` then takes the `no_body` early-return branch and never calls `attachOutline`. **The test should pass unchanged.** If it does fail, the only thing that should need touching is `useGLTF` returning a scene with a mocked traversable mesh; do not introduce real Three.js geometry into the hook test — instead, confirm that the early-return in `buildVisualPlan` is hit.

- [ ] **Step 9.3: Lint**

Run: `pnpm lint`

Expected: no new errors. The new outline code uses no suppressors (no `!`, no `??` on lookups, no `as`, no disables). If a suppressor lint script exists (`pnpm lint:suppressors`), run that too.

- [ ] **Step 9.4: Tell the user**

Stop here and report: "Tasks 1–9 done. All checks green. Ready for visual verification (Task 10)?" Do not run the dev server yourself — the user controls when to start it.

---

## Task 10 — Visual verification

**Files:** none (manual smoke).

- [ ] **Step 10.1: Start the dev server**

The user runs `pnpm dev` and opens the app in the browser.

- [ ] **Step 10.2: Verify outline**

Look at any planet on screen. The silhouette should now show a thin dark edge — clean, illustrated-looking, uniform across all planets including Mercury, Pluto, Neptune, the Moon, the Sun, and the `*_a` filler variants. The outline should be visible against the dark background but subtle (about half the contrast of the planet body color).

- [ ] **Step 10.3: Verify the universal pulse on previously-static planets**

Hover near the Moon / Pluto / Mercury / Sun (planets that previously sat at a flat emissive intensity). They should now visibly breathe — slowly (~20s period), low amplitude. The effect is most visible on the darker pastel planets where the emissive shift relative to base is largest.

- [ ] **Step 10.4: Verify the six active-capable planets are unchanged**

Trigger the active state on jupiter_b / saturn_b / mars_b / earth_b / venus_b / uranus_b (approach with the ship to activate proximity). The rim atmosphere should fade in identically to before — same color, same shimmer, same scale pulse, same opacity breathing. The body pulse should look identical to its pre-change behavior (the explicit `floor: 0.5` reproduces the prior `PULSE_FLOOR` exactly). The outline should sit cleanly behind the rim and visually disappear into the active glow where they overlap.

- [ ] **Step 10.5: Verify the previews**

Open the company info panel (active planet → preview) and the progress card (planet progress indicator). The preview planets should also show the outline and should pulse. Same rotation as before; no other behavioral change.

- [ ] **Step 10.6: Tune (only if needed)**

If anything looks off:

- **Outline too dark / too bright:** Adjust `OUTLINE_OPACITY` in `planetVisualPlan.ts` (constant in Task 4). Range to try: `0.4`–`0.7`.
- **Outline too thick / too thin:** Adjust `OUTLINE_SCALE`. Range: `1.015`–`1.04`.
- **Pulse too obvious / not visible on previously-static planets:** Adjust `DEFAULT_BODY_ONLY.pulse.amplitude` in `planetAssets.ts`. Range: `0.08`–`0.16`. Or `frequencyHz` to slow it further (range: `0.03`–`0.07`).

Each tuning knob is a one-line change. Re-run `pnpm test` to confirm no test became sensitive to the literal value (the unit tests use their own values, not these constants).

- [ ] **Step 10.7: Final commit (user runs, if anything was tuned)**

```bash
git add src/features/scene/services/renderer/planetVisualPlan.ts \
        src/features/scene/services/renderer/planetAssets.ts
git commit -m "chore(scene): tune outline opacity / scale / default pulse after visual verification"
```

---

## Closing notes

- **What ships:** A silhouette outline on every planet, a gentle universal emissive pulse on every planet, no change to the active-mode rim atmosphere, no API change to `Planet.tsx` or any widget/route/component above the renderer service layer.
- **What doesn't:** Surface motion (rotating shadow bands, drifting highlights), per-planet outline tuning, per-planet tinted pulse for previously-plain assets, refactoring of the `PlanetPreview.tsx` / `PlanetCanvas.tsx` duplication.
- **Iron Law audit (in the spec doc):** `planetTypes` lives in `services/renderer/`, no core/port changes, no suppressors used. All new fields are mandatory on their variants — no optional rim, no optional outline, no optional pulse. The `PULSE_FLOOR` and `PLAIN_EMISSIVE_INTENSITY` module constants are deleted, not relocated; the per-pulse `floor` field is the single source of truth.
