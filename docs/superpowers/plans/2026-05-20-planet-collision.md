# Planet Collision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block the spaceship from entering planet bodies by generalising the existing `SunCollider` into a unified `SphereColliders` registry that Sun and every Planet write into; `Player.tsx` folds `clampOutOfSphere` over the list.

**Architecture:** Hexagonal — `clampOutOfSphere` stays in `services/renderer/` (pure). The registry is an adapter port living in `Scene/useSceneRefs.ts` (composition root). Sun and Planet are producers (register); Player is the consumer (fold). The `PlanetRadii` activation registry is untouched — collision (body × 1.5) and proximity activation (body × 6.75) remain separate concerns.

**Tech Stack:** TypeScript, React, React Three Fiber, vitest.

**Spec reference:** `docs/superpowers/specs/2026-05-20-planet-collision-design.md`

---

## File Map

**Create:**
- `src/features/scene/components/Scene/useSceneRefs.test.ts` — factory tests for `createSphereColliders`.
- `src/features/scene/services/renderer/planetCollider.ts` — pure `planetCollider(extraction, placement, scale): Sphere` helper.
- `src/features/scene/services/renderer/planetCollider.test.ts` — tests for the helper.

**Modify:**
- `src/features/scene/components/Scene/useSceneRefs.ts` — replace `SunCollider` with `SphereColliders`.
- `src/features/scene/components/Scene/Sun.tsx` — register under `'sun'`.
- `src/features/scene/components/Scene/Player.tsx` — fold over `list()`.
- `src/features/scene/components/Scene/Scene.tsx` — rename ref, pass through to Sun/Player/Companies.
- `src/features/scene/components/Scene/Companies.tsx` — accept registry ref, pass to each `Planet`.
- `src/features/scene/components/Scene/Planet.tsx` — accept registry ref, register body sphere.

---

## Task 1 — `SphereColliders` registry primitive

Add the new type and factory in `useSceneRefs.ts`, with a dedicated unit test for the factory's behaviour. Sun still uses the old `SunCollider` after this task (we migrate Sun in Task 3).

**Files:**
- Modify: `src/features/scene/components/Scene/useSceneRefs.ts`
- Create: `src/features/scene/components/Scene/useSceneRefs.test.ts`

---

- [ ] **Step 1 — Write the failing factory test**

Create `src/features/scene/components/Scene/useSceneRefs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createSphereColliders } from './useSceneRefs';
import type { Sphere } from '../../services/renderer/clampOutOfSphere';

const sphereA: Sphere = { center: { x: 1, y: 2, z: 3 }, radius: 4 };
const sphereB: Sphere = { center: { x: 5, y: 6, z: 7 }, radius: 8 };
const sphereAReplacement: Sphere = { center: { x: 9, y: 9, z: 9 }, radius: 1 };

describe('createSphereColliders', () => {
  it('list() returns an empty array before any register call', () => {
    const colliders = createSphereColliders();
    expect(colliders.list()).toEqual([]);
  });

  it('after a single register, list() returns one sphere matching the registered value', () => {
    const colliders = createSphereColliders();
    colliders.register('a', sphereA);
    expect(colliders.list()).toEqual([sphereA]);
  });

  it('re-registering the same id replaces the value rather than appending', () => {
    const colliders = createSphereColliders();
    colliders.register('a', sphereA);
    colliders.register('a', sphereAReplacement);
    expect(colliders.list()).toEqual([sphereAReplacement]);
  });

  it('registering distinct ids accumulates entries — both spheres are present in list()', () => {
    const colliders = createSphereColliders();
    colliders.register('a', sphereA);
    colliders.register('b', sphereB);
    const result = colliders.list();
    expect(result).toHaveLength(2);
    expect(result).toContain(sphereA);
    expect(result).toContain(sphereB);
  });
});
```

- [ ] **Step 2 — Run the test to verify it fails**

Run: `pnpm test src/features/scene/components/Scene/useSceneRefs.test.ts`

Expected: FAIL with `createSphereColliders` not exported from `./useSceneRefs`.

- [ ] **Step 3 — Add `SphereColliders` type and `createSphereColliders` factory**

Edit `src/features/scene/components/Scene/useSceneRefs.ts`. Add the type and factory above the existing `SunCollider` block (do **not** delete `SunCollider` yet — Task 3 does that). Insert the following between the closing brace of `createPlanetActivations` (line 50) and the `// Single-sphere collider registry` block (line 52):

```ts
// String-keyed registry of sphere colliders. Sun and each planet register
// their body sphere under a stable id; Player.tsx folds clampOutOfSphere
// across list() each frame. Unregistered colliders never appear in list(),
// so the fold's initial position is the identity when nothing is measured
// yet — no `undefined` ever leaks (Iron Law 3).
export type SphereColliders = {
  readonly register: (id: string, sphere: Sphere) => void;
  readonly list: () => ReadonlyArray<Sphere>;
};

export const createSphereColliders = (): SphereColliders => {
  const inner = new Map<string, Sphere>();
  return {
    register: (id, sphere) => {
      inner.set(id, sphere);
    },
    list: () => [...inner.values()],
  };
};

```

- [ ] **Step 4 — Run the test to verify it passes**

Run: `pnpm test src/features/scene/components/Scene/useSceneRefs.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5 — Run typecheck + lint to ensure no suppressors and types are clean**

Run: `pnpm typecheck && pnpm lint && pnpm lint:suppressors`

Expected: PASS, no diagnostics.

- [ ] **Step 6 — Commit**

```bash
git add src/features/scene/components/Scene/useSceneRefs.ts \
        src/features/scene/components/Scene/useSceneRefs.test.ts
git commit -m "feat(scene): SphereColliders registry — string-keyed Sphere list"
```

---

## Task 2 — `planetCollider` pure helper

Build the pure function that turns a `BodyExtraction` + placement + scale into a `Sphere`. This is what `Planet.tsx` will call to compute its collider in Task 4. Pulling it out of the component gives us a clean unit-test surface — Planet's render path needs R3F mocks, but this helper is plain TS.

**Files:**
- Create: `src/features/scene/services/renderer/planetCollider.ts`
- Create: `src/features/scene/services/renderer/planetCollider.test.ts`

---

- [ ] **Step 1 — Write the failing test**

Create `src/features/scene/services/renderer/planetCollider.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { planetCollider } from './planetCollider';
import type { BodyExtraction } from './planetTypes';

const dummyMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

describe('planetCollider', () => {
  it('returns radius 0 for a no_body extraction so clampOutOfSphere no-ops', () => {
    const extraction: BodyExtraction = { kind: 'no_body' };
    const sphere = planetCollider(extraction, [10, 0, -20], 1.5);
    expect(sphere.radius).toBe(0);
    expect(sphere.center).toEqual({ x: 10, y: 0, z: -20 });
  });

  it('multiplies the extracted body radius by the scale factor for a body extraction', () => {
    const extraction: BodyExtraction = {
      kind: 'body',
      mesh: dummyMesh,
      radius: 4,
      poleDirection: [0, 1, 0],
    };
    const sphere = planetCollider(extraction, [0, 0, 0], 1.5);
    expect(sphere.radius).toBeCloseTo(6, 6);
  });

  it('multiplies the extracted body radius by the scale factor for a ringed_body extraction (rings excluded)', () => {
    const extraction: BodyExtraction = {
      kind: 'ringed_body',
      mesh: dummyMesh,
      radius: 1,
      poleDirection: [0, 1, 0],
    };
    const sphere = planetCollider(extraction, [80, 0, 0], 1.5);
    expect(sphere.radius).toBeCloseTo(1.5, 6);
    expect(sphere.center).toEqual({ x: 80, y: 0, z: 0 });
  });

  it('center is the placement tuple expressed as a Vec3 — independent of extraction kind', () => {
    const extraction: BodyExtraction = { kind: 'no_body' };
    expect(planetCollider(extraction, [1, 2, 3], 1.5).center).toEqual({ x: 1, y: 2, z: 3 });
  });
});
```

- [ ] **Step 2 — Run the test to verify it fails**

Run: `pnpm test src/features/scene/services/renderer/planetCollider.test.ts`

Expected: FAIL — `planetCollider` not exported.

- [ ] **Step 3 — Implement `planetCollider`**

Create `src/features/scene/services/renderer/planetCollider.ts`:

```ts
import type { Sphere } from './clampOutOfSphere';
import type { BodyExtraction } from './planetTypes';

// Builds the collision sphere for a planet from its extracted body and
// scene-graph placement. Rings are excluded because `extractBody` already
// reports body-only radius (minDim/2 — the ring-normal half-thickness for
// merged ringed meshes). A `no_body` extraction folds into a radius-0
// sphere — `clampOutOfSphere` treats radius 0 as a no-op, so unmeasured
// planets are observationally absent from the collider list.
export const planetCollider = (
  extraction: BodyExtraction,
  placement: readonly [number, number, number],
  scale: number,
): Sphere => {
  const bodyRadius = extraction.kind === 'no_body' ? 0 : extraction.radius;
  return {
    center: { x: placement[0], y: placement[1], z: placement[2] },
    radius: bodyRadius * scale,
  };
};
```

- [ ] **Step 4 — Run the test to verify it passes**

Run: `pnpm test src/features/scene/services/renderer/planetCollider.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5 — Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint && pnpm lint:suppressors`

Expected: PASS.

- [ ] **Step 6 — Commit**

```bash
git add src/features/scene/services/renderer/planetCollider.ts \
        src/features/scene/services/renderer/planetCollider.test.ts
git commit -m "feat(scene): planetCollider pure helper — extraction + placement → Sphere"
```

---

## Task 3 — Migrate Sun and Player to `SphereColliders`; delete `SunCollider`

Switch the sun's writer and the player's reader to use the new registry. The fold runs over `list()` and clamps through every sphere. After this task the sun still bounces the ship (no behavioural change) but the plumbing is uniform. `SunCollider` is fully removed.

**Files:**
- Modify: `src/features/scene/components/Scene/useSceneRefs.ts`
- Modify: `src/features/scene/components/Scene/Sun.tsx`
- Modify: `src/features/scene/components/Scene/Player.tsx`
- Modify: `src/features/scene/components/Scene/Scene.tsx`

---

- [ ] **Step 1 — Delete `SunCollider` and its factory from `useSceneRefs.ts`**

Edit `src/features/scene/components/Scene/useSceneRefs.ts`:

- Remove the block from line 52 (`// Single-sphere collider registry`) through line 71 (closing brace of `createSunCollider`) — i.e. the `SunCollider` type, `EMPTY_SPHERE` constant, and `createSunCollider` factory.
- In the `SceneRefs` type at lines 73-78, replace `readonly sunColliderRef: RefObject<SunCollider>;` with `readonly sphereCollidersRef: RefObject<SphereColliders>;`.
- In `useSceneRefs` at lines 80-86, replace:
  - `const sunColliderRef = useRef<SunCollider>(createSunCollider());`
    with `const sphereCollidersRef = useRef<SphereColliders>(createSphereColliders());`
  - `return { meshRef, planetRadiiRef, planetActivationsRef, sunColliderRef };`
    with `return { meshRef, planetRadiiRef, planetActivationsRef, sphereCollidersRef };`

The file should still import `Sphere` (used by `SphereColliders`). After the edits, the final file body looks like:

```ts
import type { RefObject } from 'react';
import { useRef } from 'react';
import type { Object3D } from 'three';
import type { CompanyId } from '../../types/company';
import type { Sphere } from '../../services/renderer/clampOutOfSphere';

// TotalMap-style proof-bearing registry for per-planet activation radii.
// `read` always returns `number` — the internal "not-yet-measured" case is
// folded into 0 inside the boundary, never surfacing as `number | undefined`.
// Callers never write lookup-shaped `??` or undefined-narrows at the call
// site (Iron Law 3, producer-reshape rule).
export type PlanetRadii = {
  readonly read: (id: CompanyId) => number;
  readonly write: (id: CompanyId, value: number) => void;
};

const createPlanetRadii = (): PlanetRadii => {
  const inner = new Map<CompanyId, number>();
  return {
    read: (id) => {
      const value = inner.get(id);
      if (value === undefined) return 0;
      return value;
    },
    write: (id, value) => {
      inner.set(id, value);
    },
  };
};

// Visual-activation registry — independent of the SceneMachine's single
// `revealing.objectId`. Each Planet asks "am I currently inside my own
// activation radius?" and the answer is a per-planet boolean, so multiple
// planets can be visually active at once if the player is within several
// activation radii simultaneously. ProximityWatcher publishes the current
// set every frame.
export type PlanetActivations = {
  readonly isActive: (id: CompanyId) => boolean;
  readonly publish: (active: ReadonlySet<CompanyId>) => void;
};

const createPlanetActivations = (): PlanetActivations => {
  let active: ReadonlySet<CompanyId> = new Set();
  return {
    isActive: (id) => active.has(id),
    publish: (next) => {
      active = next;
    },
  };
};

// String-keyed registry of sphere colliders. Sun and each planet register
// their body sphere under a stable id; Player.tsx folds clampOutOfSphere
// across list() each frame. Unregistered colliders never appear in list(),
// so the fold's initial position is the identity when nothing is measured
// yet — no `undefined` ever leaks (Iron Law 3).
export type SphereColliders = {
  readonly register: (id: string, sphere: Sphere) => void;
  readonly list: () => ReadonlyArray<Sphere>;
};

export const createSphereColliders = (): SphereColliders => {
  const inner = new Map<string, Sphere>();
  return {
    register: (id, sphere) => {
      inner.set(id, sphere);
    },
    list: () => [...inner.values()],
  };
};

type SceneRefs = {
  readonly meshRef: RefObject<Object3D | null>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
};

export const useSceneRefs = (): SceneRefs => {
  const meshRef = useRef<Object3D | null>(null);
  const planetRadiiRef = useRef<PlanetRadii>(createPlanetRadii());
  const planetActivationsRef = useRef<PlanetActivations>(createPlanetActivations());
  const sphereCollidersRef = useRef<SphereColliders>(createSphereColliders());
  return { meshRef, planetRadiiRef, planetActivationsRef, sphereCollidersRef };
};

export type { SceneRefs };
```

- [ ] **Step 2 — Update `Sun.tsx` to register under `'sun'`**

Edit `src/features/scene/components/Scene/Sun.tsx`:

- Line 24: replace `import type { SunCollider } from './useSceneRefs';` with `import type { SphereColliders } from './useSceneRefs';`
- Line 27: replace `readonly sunColliderRef: RefObject<SunCollider>;` with `readonly sphereCollidersRef: RefObject<SphereColliders>;`
- Lines 118-121 — replace the existing block:
  ```ts
  props.sunColliderRef.current.write({
    center: { x: SUN_POSITION[0], y: SUN_POSITION[1], z: SUN_POSITION[2] },
    radius: worldRadius,
  });
  ```
  with:
  ```ts
  props.sphereCollidersRef.current.register('sun', {
    center: { x: SUN_POSITION[0], y: SUN_POSITION[1], z: SUN_POSITION[2] },
    radius: worldRadius,
  });
  ```

- [ ] **Step 3 — Update `Player.tsx` to fold over the collider list**

Edit `src/features/scene/components/Scene/Player.tsx`:

- Line 15: replace `import type { SunCollider } from './useSceneRefs';` with `import type { SphereColliders } from './useSceneRefs';`
- Line 23: replace `readonly sunColliderRef: RefObject<SunCollider>;` with `readonly sphereCollidersRef: RefObject<SphereColliders>;`
- Lines 175-178 — replace:
  ```ts
  const clampedPosition = clampOutOfSphere(
    integrated.position,
    props.sunColliderRef.current.read(),
  );
  ```
  with:
  ```ts
  const clampedPosition = props.sphereCollidersRef.current
    .list()
    .reduce((pos, sphere) => clampOutOfSphere(pos, sphere), integrated.position);
  ```

The identity-check on line 180 (`clampedPosition === integrated.position`) keeps working — when every sphere is "outside", `clampOutOfSphere` returns its input reference unchanged (see `clampOutOfSphere.ts:23`), so the fold's accumulator is referentially the same as the initial seed and the existing fast-path triggers.

- [ ] **Step 4 — Update `Scene.tsx` to thread the new ref name**

Edit `src/features/scene/components/Scene/Scene.tsx`:

- Line 51 — replace:
  ```ts
  const { meshRef, planetRadiiRef, planetActivationsRef, sunColliderRef } = useSceneRefs();
  ```
  with:
  ```ts
  const { meshRef, planetRadiiRef, planetActivationsRef, sphereCollidersRef } = useSceneRefs();
  ```
- Line 60 — replace `<Sun sunColliderRef={sunColliderRef} />` with `<Sun sphereCollidersRef={sphereCollidersRef} />`
- Line 71 — replace `sunColliderRef={sunColliderRef}` with `sphereCollidersRef={sphereCollidersRef}`

(Companies gets the ref in Task 4 — leave it for now.)

- [ ] **Step 5 — Run all existing tests to verify nothing regresses**

Run: `pnpm test`

Expected: PASS. Every previously-green test still passes. Specifically, `Scene.test.tsx` mounts under every state without throwing, and `clampOutOfSphere.test.ts` (untouched primitive) still passes.

- [ ] **Step 6 — Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint && pnpm lint:suppressors`

Expected: PASS — no references to `SunCollider` should remain.

- [ ] **Step 7 — Verify deletion is complete**

Run: `grep -rn "SunCollider\|sunColliderRef" src/`

Expected: no output. (If any references remain, fix them — the migration is incomplete.)

- [ ] **Step 8 — Commit**

```bash
git add src/features/scene/components/Scene/useSceneRefs.ts \
        src/features/scene/components/Scene/Sun.tsx \
        src/features/scene/components/Scene/Player.tsx \
        src/features/scene/components/Scene/Scene.tsx
git commit -m "refactor(scene): migrate Sun and Player to SphereColliders fold"
```

---

## Task 4 — Planet registers its body sphere

Wire the new registry down to `Planet.tsx` through `Companies.tsx`. Each Planet calls `planetCollider(extraction, placement, PLANET_BASE_SCALE)` and registers under its `CompanyId`. Player's fold automatically picks them up — no further Player changes needed.

**Files:**
- Modify: `src/features/scene/components/Scene/Companies.tsx`
- Modify: `src/features/scene/components/Scene/Planet.tsx`
- Modify: `src/features/scene/components/Scene/Scene.tsx`

---

- [ ] **Step 1 — Extend `Companies.tsx` to accept and forward the registry ref**

Edit `src/features/scene/components/Scene/Companies.tsx`. Replace the entire file with:

```tsx
import type { JSX, RefObject } from 'react';
import type { PlanetProjection } from '../../types/projections';
import type { PlanetActivations, PlanetRadii, SphereColliders } from './useSceneRefs';
import { Planet } from './Planet';

type CompaniesProps = {
  readonly planets: ReadonlyArray<PlanetProjection>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
};

export const Companies = (props: CompaniesProps): JSX.Element => (
  <group>
    {props.planets.map((planet) => (
      <Planet
        key={planet.id}
        planet={planet}
        planetRadiiRef={props.planetRadiiRef}
        planetActivationsRef={props.planetActivationsRef}
        sphereCollidersRef={props.sphereCollidersRef}
      />
    ))}
  </group>
);
```

- [ ] **Step 2 — Add the ref to `Planet.tsx`, import the helper, register the body sphere**

Edit `src/features/scene/components/Scene/Planet.tsx`:

- After line 13 (`import type { PlanetVisualPlan } from '../../services/renderer/planetTypes';`), add:
  ```ts
  import { planetCollider } from '../../services/renderer/planetCollider';
  ```
- Line 23: replace
  ```ts
  import type { PlanetActivations, PlanetRadii } from './useSceneRefs';
  ```
  with:
  ```ts
  import type { PlanetActivations, PlanetRadii, SphereColliders } from './useSceneRefs';
  ```
- Lines 25-29 — extend `PlanetProps`:
  ```ts
  type PlanetProps = {
    readonly planet: PlanetProjection;
    readonly planetRadiiRef: RefObject<PlanetRadii>;
    readonly planetActivationsRef: RefObject<PlanetActivations>;
    readonly sphereCollidersRef: RefObject<SphereColliders>;
  };
  ```
- Lines 61-72 — refactor `deriveBodyValues` to also surface the extraction so the caller can pass it into `planetCollider`. Replace the existing block:

  ```ts
  type BodyDerivations = {
    readonly activeRadius: number;
    readonly pose: PlanetPose;
  };

  const deriveBodyValues = (scene: Object3D): BodyDerivations => {
    const extraction = extractBody(scene);
    const pose = planetPoseFor(extraction);
    if (extraction.kind === 'no_body') return { activeRadius: 0, pose };
    const activeRadius = extraction.radius * PLANET_BASE_SCALE * ACTIVATION_RADIUS_MULTIPLIER;
    return { activeRadius, pose };
  };
  ```

  with:

  ```ts
  type BodyDerivations = {
    readonly activeRadius: number;
    readonly pose: PlanetPose;
    readonly extraction: BodyExtraction;
  };

  const deriveBodyValues = (scene: Object3D): BodyDerivations => {
    const extraction = extractBody(scene);
    const pose = planetPoseFor(extraction);
    if (extraction.kind === 'no_body') return { activeRadius: 0, pose, extraction };
    const activeRadius = extraction.radius * PLANET_BASE_SCALE * ACTIVATION_RADIUS_MULTIPLIER;
    return { activeRadius, pose, extraction };
  };
  ```

- Add the `BodyExtraction` type import. At line 13 (the `import type { PlanetVisualPlan }` line), expand to:
  ```ts
  import type { BodyExtraction, PlanetVisualPlan } from '../../services/renderer/planetTypes';
  ```
- In the `Planet` component body (after line 116 — the `write(activeRadius)` call), register the collider:

  Replace the existing single line:
  ```ts
  props.planetRadiiRef.current.write(props.planet.id, derived.activeRadius);
  ```
  with:
  ```ts
  props.planetRadiiRef.current.write(props.planet.id, derived.activeRadius);
  props.sphereCollidersRef.current.register(
    props.planet.id,
    planetCollider(derived.extraction, props.planet.planet.placement, PLANET_BASE_SCALE),
  );
  ```

- [ ] **Step 3 — Wire the ref through `Scene.tsx` to `Companies`**

Edit `src/features/scene/components/Scene/Scene.tsx`. In the `<Companies />` element (lines 73-77), add `sphereCollidersRef`:

```tsx
<Companies
  planets={planets}
  planetRadiiRef={planetRadiiRef}
  planetActivationsRef={planetActivationsRef}
  sphereCollidersRef={sphereCollidersRef}
/>
```

- [ ] **Step 4 — Run all tests**

Run: `pnpm test`

Expected: PASS. `Planet.test.tsx`, `Scene.test.tsx`, `useSceneRefs.test.ts`, `planetCollider.test.ts`, `clampOutOfSphere.test.ts` all green. No new failures.

- [ ] **Step 5 — Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint && pnpm lint:suppressors`

Expected: PASS.

- [ ] **Step 6 — Manual verification in the dev server**

Run: `pnpm dev`

Open the browser. Steer the ship into each planet (mave / saturn / mars / venus / uranus). Expected:

- Ship cannot enter the planet's body. It slides along the surface as long as forward input is held.
- For Saturn and Uranus, the ship can still fly through the ring disc (only the body blocks).
- Sun behaviour unchanged — still bounces from `(180, 0, -320)` ± body radius.
- Proximity activation (info panel reveal) still fires when approaching a planet.

If any planet does not block, stop and diagnose before committing.

- [ ] **Step 7 — Commit**

```bash
git add src/features/scene/components/Scene/Companies.tsx \
        src/features/scene/components/Scene/Planet.tsx \
        src/features/scene/components/Scene/Scene.tsx
git commit -m "feat(scene): planets register body sphere with SphereColliders — ship cannot enter planet bodies"
```

---

## Self-review checklist (run after all four tasks)

- [ ] `grep -rn "SunCollider\|sunColliderRef" src/` returns no results.
- [ ] `pnpm check` passes (typecheck + lint + lint:suppressors + tests).
- [ ] Manual: ship is blocked at every planet body; rings remain pass-through; sun behaviour unchanged.
- [ ] No `// TODO`, `// FIXME`, "for now", or "temporary" comments introduced in the diff.
