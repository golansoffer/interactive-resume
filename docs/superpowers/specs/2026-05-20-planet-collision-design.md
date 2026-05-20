# Planet Collision — Design

## Goal

The spaceship currently flies through the visible body of every planet (only the sun has a collider). Add per-planet sphere collision so the ship cannot enter any planet body, matching the existing sun behaviour.

Rings remain pass-through — collision uses the body radius only, which `extractBody` already returns (it picks the most spherical descendant and reports `minDim/2`, the ring-normal half-thickness for merged ringed meshes).

## Non-goals

- No velocity reflection / bounce dynamics — the ship's velocity is unchanged on contact, exactly like the sun today. The position projects to the surface; the next frame integrates again.
- No ring collision.
- No change to the proximity/activation flow (`PlanetRadii`, `ProximityWatcher`, scene state machine). Activation radius (`body × 6.75`) and collision radius (`body × 1.5`) are separate concerns and stay separate.
- No frame-by-frame collider updates from breathing scale (±2.5 %) or sway (~0.5°). Static collider per planet — registered once on measure.

## Approach — unified `SphereColliders` registry

Replace `SunCollider` with one registry that holds every collider sphere keyed by string id. Sun registers under `'sun'`; each Planet registers under its `CompanyId`. `Player.tsx` folds `clampOutOfSphere` over `colliders.list()`.

```ts
// src/features/scene/components/Scene/useSceneRefs.ts
export type SphereColliders = {
  readonly register: (id: string, sphere: Sphere) => void;
  readonly list: () => ReadonlyArray<Sphere>;
};
```

Implementation: internal `Map<string, Sphere>`; `list()` returns `[...map.values()]`. Empty list = identity fold (correct behaviour before Sun and Planets mount). No `undefined` ever leaks — the absence of colliders is "empty array", which the fold handles as a no-op.

### Why this shape

- **One concept, one type.** Sun and planets share the exact same physics (sphere → `clampOutOfSphere`). Two registries with different surface shapes would model the same thing twice (Iron Law 4: design discipline).
- **Producer-reshape, not consumer-guard.** The registry returns `ReadonlyArray<Sphere>`. `Player.tsx` never branches on "is sun measured", "is planet measured" — it just folds. Unmeasured = not yet registered = not in the list (Iron Law 3).
- **No lookup-shaped `??`.** The fold's initial value is the integrated position; each step returns a `Vec3`. No optional chaining, no `T | undefined`.

## Component changes

### `useSceneRefs.ts`

- Delete `SunCollider`, `createSunCollider`, `EMPTY_SPHERE`, `sunColliderRef`.
- Add `SphereColliders` type, `createSphereColliders` factory, `sphereCollidersRef`.
- Return `sphereCollidersRef` instead of `sunColliderRef` from the hook.

### `Sun.tsx`

- Change prop type from `SunCollider` to `SphereColliders`.
- Replace `props.sunColliderRef.current.write({...})` with `props.sphereCollidersRef.current.register('sun', {...})`.
- No other changes — position, radius computation, render unchanged.

### `Planet.tsx`

- Add `sphereCollidersRef` prop (`RefObject<SphereColliders>`).
- After `deriveBodyValues`, compute body sphere:
  ```ts
  const bodyRadius = (extraction.kind === 'no_body' ? 0 : extraction.radius) * PLANET_BASE_SCALE;
  const [px, py, pz] = props.planet.planet.placement;
  props.sphereCollidersRef.current.register(props.planet.id, {
    center: { x: px, y: py, z: pz },
    radius: bodyRadius,
  });
  ```
- `bodyRadius` of 0 (no_body) registers a degenerate sphere; `clampOutOfSphere` treats radius-0 as a no-op, so this is safe and matches the sun's unmeasured-fallback semantics.
- Refactor `deriveBodyValues` so the inner body radius is reusable for both the activation radius (`PlanetRadii`) and the collider — avoid recomputing `extractBody` twice.

### `Player.tsx`

- Change prop type from `sunColliderRef: RefObject<SunCollider>` to `sphereCollidersRef: RefObject<SphereColliders>`.
- Replace the single `clampOutOfSphere` call with a fold:
  ```ts
  const spheres = props.sphereCollidersRef.current.list();
  const clampedPosition = spheres.reduce(
    (pos, sphere) => clampOutOfSphere(pos, sphere),
    integrated.position,
  );
  ```
- Identity check `clampedPosition === integrated.position` keeps the existing fast path: when no sphere actually clamped (every step returned its input), the integrated kinematics object is reused without a copy. The fold preserves reference identity because `clampOutOfSphere` returns the input unchanged when the point is outside the sphere (see `clampOutOfSphere.ts:23`).

### `Scene.tsx`

- Rename `sunColliderRef` → `sphereCollidersRef` in destructuring and prop wiring.
- Pass `sphereCollidersRef` to both `<Sun>` and each `<Planet>`.

## Layer compliance

- **Core:** unchanged. `clampOutOfSphere` is already pure; the registry lives in the renderer adapter.
- **Ports:** `SphereColliders` is a typed adapter-side port; `clampOutOfSphere(Vec3, Sphere)` is the cross-boundary primitive.
- **Adapters:** Sun and Planet are producers (register); Player is the consumer (fold-and-clamp). No adapter reaches across — they share state only through the registry.
- **Iron Law 4 — solve more with less:** Deletes `SunCollider`, `createSunCollider`, `EMPTY_SPHERE`. Adds one general type and one factory. Net: simpler.

## Tests

Three test surfaces:

### 1. `useSceneRefs` registry behaviour
New unit test for `createSphereColliders`:
- Empty `list()` returns `[]`.
- After `register('a', sphereA)`, `list()` contains `sphereA`.
- After `register('a', sphereA1)` overwriting, `list()` contains `sphereA1` (no duplicate).
- After `register('a', _)` and `register('b', _)`, `list()` contains both.

### 2. `Sun` registers as `'sun'`
Updated `Scene.test.tsx` / `Sun` tests — render and assert the registry has one entry with the expected sphere. Equivalent to the current sun-write assertion.

### 3. `Planet` registers body sphere
Updated `Planet.test.tsx`:
- Renders a planet, registry contains an entry keyed by the planet's `CompanyId` with `radius === extractedBodyRadius × PLANET_BASE_SCALE` and `center === placement`.
- Saturn / Uranus (ringed) registers the body radius, not the bbox half-diagonal — assert against `extractBody` output.

### 4. Player clamps through every collider
Updated `Scene.test.tsx` integration:
- Drive the ship's integrated position to be inside a planet's body sphere; assert the post-frame position lies on the surface (distance to planet center === collider radius, within float tolerance).
- Existing sun-clamp test: convert to use the unified registry; behaviour unchanged.

`clampOutOfSphere.test.ts` is unaffected — primitive untouched.

## Edge cases

- **Ship spawns inside a planet's collider zone at start.** First frame: integrator runs, fold pushes ship onto the surface. Player visible spawn position is the placement origin `(0,0,0)` (current code) — well outside every planet (ring radius 80). No issue.
- **Ship at very high speed clipping through a collider in one frame ("tunnelling").** Possible in principle if `velocity × dt > 2 × radius`. With `MAX_SPEED = 14` (from `kinematics.ts`) and `dt ≈ 0.016 s`, max single-frame translation ≈ 0.22 world units. Body collider radius is on the order of `extractBody × 1.5` ≈ 5–10 units. No tunnelling at this scale.
- **Two colliders the ship is simultaneously inside.** Cannot happen with current placements (sun is 250+ units from any planet body; planets sit on an orbital ring of radius 80 spaced every 72°, ~94 units apart). Fold semantics still terminate correctly — each step is idempotent on points already outside.
- **`extractBody` returns `no_body`.** Falls back to radius 0; `clampOutOfSphere` is a no-op. Same behaviour as today's unmeasured sun. Logged elsewhere if assets break.

## Implementation order

1. Replace `SunCollider` with `SphereColliders` in `useSceneRefs.ts` (registry primitive).
2. Update `Sun.tsx` and `Scene.tsx` to the new ref name — verify sun collision still works (existing tests pass).
3. Add `Planet.tsx` registration and `Player.tsx` fold — verify planet collision works.
4. Add tests at each step (TDD).

Each step is a green-test commit. No "for now" / "temporary" steps — every commit leaves the codebase in a consistent state.
