# Solar System Tour — Design Spec

**Date:** 2026-05-21
**Status:** Draft (pending user spec review)
**Scope:** Re-arrange the scene into a recognizable solar system, lay the five career planets along a single tour route from Saturn to Venus, render the remaining planets as filler, add a hold-Space boost, and guide the player with layered 3D + HUD waypoint cues.

---

## Goal

Today the five company planets sit on an equally-spaced ring of radius 80 with the sun off-axis. The arrangement is geometric, not narrative — the player has no sense of where to go, no journey, no progression. This spec turns the scene into a directed tour:

1. **Real solar-system order, on a single +Z route.** Saturn → Jupiter → Mars → Earth → Venus, with Mercury / Uranus / Neptune rendered off-axis as filler.
2. **Career story descends toward the origin.** Saturn = current role (Mave), Venus = first role (TGS), Sun = symbolic origin / scenery terminus.
3. **The next stop is always discoverable.** A 3D beam at the most recently visited planet points toward the next career stop; a screen-edge HUD arrow takes over when the next stop is off-camera.
4. **Boost.** Hold Space → ship targets 3× normal speed. Auto-cuts when the ship enters any planet's activation zone, so the player never overshoots.
5. **Hybrid traversal.** The player can skip ahead or backtrack; the waypoint always recommends the first unvisited stop in route order.

Performance budget: zero post-processing, no new shaders beyond what already exists, all costs constant per frame.

---

## Non-Goals

- No URL persistence of visited state. Reload resets the tour.
- No autopilot / click-to-fly nav menu (separate future feature; design is intentionally additive, not blocking).
- No sun arrival reveal ("tour complete" UI when entering the sun's proximity). Sun stays scenery-only; that decision is deferred.
- No new post-processing passes, no motion blur, no chromatic aberration.
- No changes to chase-cam dynamics (spring stiffness / damping / banking), ship physics constants (`ACCELERATION` / `DECELERATION` / `MAX_SPEED`), `ProximityWatcher`, sun collider/halo/corona/animation, or planet rotation/sway/breath rules.

---

## Layout & Geometry

Camera-relative motion in the existing integrator makes the initial `move_forward` direction `+Z`. The route is laid along the `+Z` axis with the sun farthest, so pressing `W` from spawn flies the player straight down the tour.

```
        Filler (off-axis, behind start)
            ●  Neptune (-55, 0, -200)
              ●  Uranus  ( 40, 0, -110)

  ←-Z ────────────●──────●──────●──────●──────●─────●────────────●────── +Z →
                  0     70    170    250    325    395          560
                Player Saturn Jupiter Mars   Earth  Venus      Sun
                start  Mave   8fig    River- Stream TGS       (scenery
                              side    Elements                terminus)

                                                       ●  Mercury (0, 0, 445)
                                                       (filler, between Venus & sun)
```

| Body            | Position (x, y, z) | Asset       | Role                          |
|-----------------|--------------------|-------------|-------------------------------|
| Player start    | (0, 0, 0)          | —           | behind Saturn                 |
| Saturn          | (0, 0, 70)         | `saturn_b`  | **Mave** (current)            |
| Jupiter         | (0, 0, 170)        | `jupiter_b` | **8fig**                      |
| Mars            | (0, 0, 250)        | `mars_b`    | **Riverside**                 |
| Earth           | (0, 0, 325)        | `earth_b`   | **StreamElements**            |
| Venus           | (0, 0, 395)        | `venus_b`   | **TGS** (oldest)              |
| Mercury         | (0, 0, 445)        | `mercury_b` | filler (between Venus & sun)  |
| Uranus          | (40, 0, -110)      | `uranus_b`  | filler (behind start)         |
| Neptune         | (-55, 0, -200)     | `neptune_b` | filler (further behind)       |
| Sun             | (0, 0, 560)        | `sun_b`     | scenery terminus              |

**Inter-planet spacing on the +Z axis:** career-to-career gaps are 100 / 80 / 75 / 70 (Saturn→Jupiter→Mars→Earth→Venus). Activation radius per planet is `extraction.radius × PLANET_BASE_SCALE × ACTIVATION_RADIUS_MULTIPLIER` ≈ 32 for typical bodies. Every adjacent career pair has center spacing ≥ 70, so activation zones are clear of overlap by at least ~6 units. The monotonically-decreasing gaps along the career route read as "deceleration into history" — the older the stop, the closer the stops are packed. Venus→Mercury (50) and Mercury→Sun (115) sit outside the career-route narrative — Mercury is filler, sun is the scenery terminus.

**Camera `far` plane** is raised from `500` to `800`. Required so the sun + halo at z = 560 (extent ~636 from start) doesn't clip while the ship is at the journey's beginning, and so Neptune at z = -200 doesn't pop while the ship is at Venus (player-to-Neptune distance ~595).

**Asteroid shell** remains world-anchored at radius 280 around the origin. The shell intersects the journey volume, which reads as "ambient orbital debris" passing through the scene at all journey points. No change.

**Starfield** is already camera-anchored — no change.

---

## FSM Extensions

The route is domain state. The visited-set lives in the `sceneMachine` context — same hexagon as the existing `scene: SceneState`.

```ts
// core/scene/sceneMachine.ts
type SceneMachineContext = {
  readonly scene: SceneState;
  readonly visited: ReadonlyArray<CompanyId>; // ordered by visit time, deduplicated
};
```

**Update rule** (pure, inside the existing reducer):

- `entered_proximity { objectId }` — if `objectId` is in `visited`, move it to the end; else append it. Length bounded by total career entries (5). No removal path.
- All other events leave `visited` unchanged.

Filler planets cannot reach the FSM by construction: they are not in `entries`, so `ProximityWatcher` never emits `entered_proximity` for them.

**Route order** is a single constant beside the company entries:

```ts
// features/scene/widget/scene/companies.ts
export const CAREER_ROUTE_ORDER: ReadonlyArray<CompanyId> =
  ['mave', '8fig', 'riverside', 'streamelements', 'tgs'].map(asCompanyId);
```

**Route projection** — a pure function `(visited, entries) → RouteProjection` consumed by the waypoint components.

```ts
// features/scene/types/route-projection.ts
type PlacedTarget = {
  readonly id: CompanyId;
  readonly placement: readonly [number, number, number];
};

export type RouteProjection =
  | { readonly kind: 'pre_route'; readonly firstTarget: PlacedTarget }
  | { readonly kind: 'mid_route'; readonly anchor: PlacedTarget; readonly nextTarget: PlacedTarget }
  | { readonly kind: 'complete'; readonly anchor: PlacedTarget };
```

```ts
// features/scene/widget/scene/projectRoute.ts
export const projectRoute = (
  visited: ReadonlyArray<CompanyId>,
  entries: ReadonlyArray<CompanyEntry>,
): RouteProjection;
```

The projection is frame-independent. Distance to next target and on-screen / off-screen detection are derived per frame inside `<WaypointMarker>` from `kinematicsRef` + `useThree().camera`, never persisted in the projection.

**Skipping behavior.** If the player visits Earth first, `visited = [streamelements]`, `anchor = StreamElements`, `nextTarget = first id in CAREER_ROUTE_ORDER not in visited = Mave (Saturn)`. The 3D beam at Earth points back toward Saturn; the HUD arrow shows the distance. Visiting Saturn afterward moves to `visited = [streamelements, mave]`, `anchor = Mave`, `nextTarget = 8fig`. The model is monotonic; there is no sequence of inputs that wedges the projection.

---

## Boost

**Intent type** gains a continuous variant:

```ts
// features/scene/types/intent.ts
export type Intent =
  | { readonly kind: 'move_forward' }
  | { readonly kind: 'move_backward' }
  | { readonly kind: 'strafe_left' }
  | { readonly kind: 'strafe_right' }
  | { readonly kind: 'boost' };
```

**Keyboard map** adds `Space → continuous intent 'boost'`. Modifier-key chords (`shift+space` etc.) are ignored by the existing `hasModifier` guard. No other key bindings change.

**Gating** is computed once per frame in `<Player>`'s frame loop:

```ts
const boostHeld = props.intents.current.has('boost');
const inAnyActivation = props.planetActivationsRef.current.anyActive();
const boostActive = boostHeld && !inAnyActivation;
```

`PlanetActivations` gains a single `anyActive(): boolean` method beside the existing `isActive(id)`. This is a producer-side reshape — no caller writes a defensive `!size` check on a lookup.

**Integrator** gains one positional parameter:

```ts
// features/scene/services/renderer/integrateMotion.ts
export const integrateMotion = (
  state: Kinematics,
  intents: ReadonlySet<Intent['kind']>,
  dt: number,
  basis: CameraBasis,
  multiplier: 1 | 3,
): Kinematics;
```

`targetVelocity = direction × MAX_SPEED × multiplier`. `ACCELERATION` (120) and `DECELERATION` (140) constants stay. The literal `1 | 3` union makes any other multiplier unrepresentable at the call site.

**Shared boost signal** lives in a new ref on `useSceneRefs`:

```ts
// features/scene/components/Scene/useSceneRefs.ts
export type BoostSignal = {
  readonly write: (active: boolean, factor: number) => void;
  readonly read: () => { readonly active: boolean; readonly factor: number };
};
```

`<Player>` computes `boostActive` and a smoothed `factor` (exponential lerp toward `boostActive ? 1 : 0` at rate `6 /sec`, giving a ~170 ms time constant — fast enough that boost feels responsive on press/release, slow enough that the trail and camera lifts don't snap) and writes both per frame. `<FollowCamera>` reads `factor` and applies the boost FOV bump as an additive lift on top of the existing speed-driven ramp (`fovTarget += factor × 8`) and look-ahead lift (`lookAheadAmplitude += factor × 1.8`). Existing FOV / look-ahead lerp rates apply on top of these targets.

**Trail visuals.** Two `<Trail>` siblings on the same ship anchor:

| Trail   | Color     | Width | Length | Opacity            |
|---------|-----------|-------|--------|--------------------|
| Base    | `#5fd6ff` | 6     | 4      | `1 − factor`       |
| Boost   | `#aeefff` | 8     | 8      | `factor`           |

Both trails record continuously. Opacities cross-fade from the smoothed `factor`, so the boost trail emerges as the ship accelerates and dissolves as it slows. The colors are within the same cyan hue family — boost reads as "afterburner energy" rather than "different mode color". No new accent hue is introduced to the scene palette.

---

## Waypoint Cues

Two pure renderer components, both mounted inside the Canvas. Both consume `RouteProjection` and switch on `projection.kind` — no boolean flags, no optional fields, no "is this active?" checks.

### `<WaypointBeam>` — 3D in-world cue

```ts
// features/scene/components/Scene/WaypointBeam.tsx
type WaypointBeamProps = { readonly projection: RouteProjection };
```

- `projection.kind === 'mid_route'` → renders a soft additive line from `anchor.placement` to `nextTarget.placement`. Cyan (`#5fd6ff`), additive blending, `depthWrite: false`, peak opacity ~0.25 with a slow sine pulse (`0.12 Hz`).
- `pre_route` / `complete` → returns `null`.

The line is a 2-vertex `BufferGeometry` with the start at the anchor and the end at the next target. Updated when the projection identity changes — no per-frame geometry rebuild.

### `<WaypointMarker>` — screen-edge HUD arrow

```ts
// features/scene/components/Scene/WaypointMarker.tsx
type WaypointMarkerProps = {
  readonly projection: RouteProjection;
  readonly kinematicsRef: RefObject<Kinematics>;
};
```

- `projection.kind === 'complete'` → returns `null`.
- `pre_route` → target = `firstTarget`.
- `mid_route` → target = `nextTarget`.

Per frame: projects `target.placement` into NDC via `useThree().camera`. If the NDC point is inside `[-1, 1]²` → returns `null` (the target is visible in the viewport; no chrome needed). Otherwise renders a drei `<Html>` at the clamped screen-edge position: a small chevron pointing toward the target plus a distance pill showing world-unit distance from the player. Cyan accent on a dark plate, mono caps typography — same tokens as the existing comms dock and company info panel.

The marker lives inside the Canvas (so it has camera access via `useThree`), but its `<Html>` overlay renders into the DOM next to the existing info panel and dock. No new portal target is required.

---

## Filler Planets — Root-Cause Refactor

Today `<Planet>` couples five responsibilities: load + dress GLB, register sphere collider, write to `planetRadiiRef`, register activation animation, and run the body sway each frame. Filler planets need the first two (and the body sway) but none of the others.

**Bad fix:** add a `isFiller: boolean` prop to `<Planet>` and branch internally. Banned per Iron Law 4 (boolean flag controlling flow).

**Root-cause fix:** the planet's mode is a discriminated union. The refs that only exist for the active variant live on the active variant.

```ts
// features/scene/types/planet-mode.ts
export type PlanetMode =
  | {
      readonly kind: 'active';
      readonly id: CompanyId;
      readonly planetRadiiRef: RefObject<PlanetRadii>;
      readonly planetActivationsRef: RefObject<PlanetActivations>;
    }
  | {
      readonly kind: 'filler';
      readonly id: string; // e.g. 'filler:uranus' — registry key only
    };
```

`<Planet>`'s props become:

```ts
type PlanetProps = {
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
  readonly sphereCollidersRef: RefObject<SphereColliders>;
  readonly mode: PlanetMode;
};
```

Inside `<Planet>`:

- Sphere collider always registers under `mode.id`. `SphereColliders.register` takes `string`, and both `CompanyId` and `'filler:uranus'` satisfy `string`. No leak: the registry is identity-based, not domain-typed.
- `mode.kind === 'active'`:
  - Writes the active radius into `mode.planetRadiiRef`.
  - Subscribes the activation breath / rim animation in the frame loop, driven by `mode.planetActivationsRef.current.isActive(mode.id)`.
- `mode.kind === 'filler'`:
  - Skips the radii write and the activation animation. Body sway and per-asset look (which is `plain` for unmapped asset ids, so `animatePlan` is a no-op) still run.

There is no shared optional field, no `if (mode.planetRadiiRef)`. A filler branch literally cannot reference `planetRadiiRef` because the type doesn't carry it.

**New files:**

```ts
// features/scene/widget/scene/fillerPlanets.ts
type FillerPlanetEntry = {
  readonly id: string;             // 'filler:uranus', 'filler:neptune', 'filler:mercury'
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
};

export const FILLER_PLANETS: ReadonlyArray<FillerPlanetEntry> = [
  { id: 'filler:uranus',  assetId: 'uranus_b',  placement: [ 40, 0, -110] },
  { id: 'filler:neptune', assetId: 'neptune_b', placement: [-55, 0, -200] },
  { id: 'filler:mercury', assetId: 'mercury_b', placement: [  0, 0,  445] },
];
```

```ts
// features/scene/components/Scene/FillerPlanets.tsx
// Pure renderer: maps FILLER_PLANETS over <Planet mode={{ kind: 'filler', id }} />.
```

`<Scene>` mounts `<Companies>` and `<FillerPlanets>` side by side. `ProximityWatcher`'s input continues to be `entries` (career only); filler planets are invisible to proximity logic by type.

---

## Architecture

Per the project's hexagonal layering:

```
src/
├── core/scene/
│   ├── sceneMachine.ts                  (edit) context gains visited: ReadonlyArray<CompanyId>;
│   │                                            reducer appends / moves-to-end on entered_proximity
│   └── sceneMachine.test.ts             (edit) visited tracking tests
│
├── features/scene/
│   ├── types/
│   │   ├── intent.ts                    (edit) add 'boost' variant
│   │   ├── route-projection.ts          (new)  RouteProjection discriminated union
│   │   └── planet-mode.ts               (new)  PlanetMode discriminated union
│   │
│   ├── services/
│   │   ├── input/
│   │   │   ├── subscribeToKeyboard.ts   (edit) Space → continuous 'boost'
│   │   │   └── subscribeToKeyboard.test.ts (edit)
│   │   └── renderer/
│   │       ├── integrateMotion.ts       (edit) gains multiplier: 1 | 3 parameter
│   │       └── integrateMotion.test.ts  (edit)
│   │
│   ├── widget/scene/
│   │   ├── companies.ts                 (edit) re-mapped placements + CAREER_ROUTE_ORDER constant
│   │   ├── fillerPlanets.ts             (new)  FILLER_PLANETS list
│   │   ├── projectRoute.ts              (new)  pure (visited, entries) → RouteProjection
│   │   ├── projectRoute.test.ts         (new)
│   │   └── useScene.ts                  (edit) exposes routeProjection in result
│   │
│   └── components/Scene/
│       ├── useSceneRefs.ts              (edit) PlanetActivations.anyActive(); BoostSignal ref
│       ├── Scene.tsx                    (edit) mount <FillerPlanets>, <WaypointBeam>, <WaypointMarker>;
│       │                                       sun position constant
│       ├── Planet.tsx                   (edit) PlanetMode discriminated prop; filler branch
│       ├── Planet.test.tsx              (edit) filler vs active mode tests
│       ├── FillerPlanets.tsx            (new)  pure renderer over FILLER_PLANETS
│       ├── Player.tsx                   (edit) boost intent gate, two trails, BoostSignal write
│       ├── FollowCamera.tsx             (edit) reads BoostSignal; FOV + look-ahead boost lifts
│       ├── WaypointBeam.tsx             (new)  3D additive line, switch on projection.kind
│       ├── WaypointBeam.test.tsx        (new)
│       ├── WaypointMarker.tsx           (new)  <Html> screen-edge marker, switch on projection.kind
│       └── WaypointMarker.test.tsx      (new)
│
└── features/scene/components/Scene/Sun.tsx
                                          (edit) SUN_POSITION → (0, 0, 560); no other changes
```

Layer compliance:

- **Core (`core/scene/`)**: only domain state mutation. Adds a single immutable array field; reducer is pure.
- **Ports**: `RouteProjection`, `PlanetMode`, `Intent`, `BoostSignal` — all discriminated unions or proof-bearing registries (Iron Law 2, 3). No optional fields used as state flags.
- **Adapters**:
  - `services/input/subscribeToKeyboard.ts` — parse boundary for keyboard events. Only place that knows about KeyboardEvent.
  - `services/renderer/integrateMotion.ts` — pure math, no React.
  - `widget/scene/projectRoute.ts` — pure projection, no React.
  - `widget/scene/useScene.ts` — composition root for the scene surface.
  - `components/Scene/*` — pure renderers. No data hooks. No router. No `useEffect` except inside the composition root and the existing keyboard subscription.

The far-plane bump (500 → 800) lives in `FollowCamera.tsx` beside the existing `far={500}` JSX prop. No new module.

---

## Tests

Following existing TDD patterns (tests beside their modules, describe behavior through ports, not implementation details).

### Pure / core

1. **`core/scene/sceneMachine.test.ts`** (extend)
   - Initial context: `visited` is `[]`.
   - `entered_proximity { objectId: 'mave' }` → `visited === ['mave']`.
   - Subsequent `entered_proximity` of a new id appends.
   - `entered_proximity` of an existing id moves it to the end (length unchanged).
   - `exited_proximity`, `pause_toggle`, `interact`, `start` leave `visited` unchanged.

2. **`features/scene/widget/scene/projectRoute.test.ts`** (new)
   - Empty `visited` → `{ kind: 'pre_route', firstTarget: <Saturn/Mave> }`.
   - `visited === ['mave']` → `{ kind: 'mid_route', anchor: Mave, nextTarget: 8fig }`.
   - Out-of-order visit `['streamelements']` (Earth first) → `nextTarget` is Mave (route order, not visit order), `anchor` is StreamElements.
   - All five visited in any order → `{ kind: 'complete', anchor: <last in visited> }`.
   - Re-visit (`['mave', '8fig', 'mave']`) → `anchor` is Mave (move-to-end).

3. **`features/scene/services/renderer/integrateMotion.test.ts`** (extend)
   - All existing assertions pass with explicit `multiplier=1`.
   - With `multiplier=3` and full-forward intent, after a long simulation step the velocity converges to `MAX_SPEED × 3` along the forward direction.

### Adapter

4. **`features/scene/services/input/subscribeToKeyboard.test.ts`** (extend)
   - `Space` keydown emits `{ kind: 'intent_down', intent: 'boost' }`.
   - `Space` keyup emits `{ kind: 'intent_up', intent: 'boost' }`.
   - `Shift+Space` ignored (existing modifier-chord rule).

### Component (through ports)

5. **`features/scene/components/Scene/Planet.test.tsx`** (extend)
   - `mode.kind === 'active'`: writes a positive radius into `planetRadiiRef`, registers a sphere collider with the matching id.
   - `mode.kind === 'filler'`: registers a sphere collider with the filler id. The discriminated `PlanetMode` type prevents the filler branch from referencing `planetRadiiRef` / `planetActivationsRef` at the type level, so the test asserts only the positive case (collider registered) — the absence of the other writes is a structural guarantee, not a runtime claim.

6. **`features/scene/components/Scene/useSceneRefs.test.ts`** (extend)
   - `PlanetActivations.anyActive()` returns `false` on a fresh registry, `true` after `publish` with any non-empty set, `false` after `publish` with an empty set.
   - `BoostSignal.read()` returns `{ active: false, factor: 0 }` initially. After `write(true, 0.4)`, `read()` returns `{ active: true, factor: 0.4 }`.

7. **`features/scene/components/Scene/WaypointBeam.test.tsx`** (new)
   - `pre_route` projection → renders nothing.
   - `complete` projection → renders nothing.
   - `mid_route` projection → renders a line geometry whose vertex positions equal `anchor.placement` and `nextTarget.placement`.

8. **`features/scene/components/Scene/WaypointMarker.test.tsx`** (new)
   - Target NDC inside `[-1, 1]²` → returns `null`.
   - Target NDC outside the box → renders `<Html>` at a clamped screen-edge position, distance pill shows the integer distance from `kinematicsRef.current.position` to the target.

No tests assert pixel values, easings, or shader internals. All behavior reachable through prop in / event out ports.

---

## Acceptance Criteria

1. `pnpm check` passes (typecheck + lint + suppressor scan + tests).
2. Dev server boots the existing `/` route. After ship selection, the scene shows planets in real solar-system order along the +Z axis with the sun as the visible terminus.
3. The player ship starts behind Saturn at the origin with the chase camera looking down the route.
4. Without boost, flying straight forward along +Z visits Saturn → Jupiter → Mars → Earth → Venus in sequence. Each entry reveals the company info panel for that planet.
5. Holding Space accelerates the ship toward 3× `MAX_SPEED`. The boost trail (`#aeefff`) emerges as the ship accelerates; the base trail (`#5fd6ff`) fades. Releasing Space — or entering any planet's activation zone — returns to base speed with the inverse cross-fade.
6. Camera FOV widens from ~64 to ~72 under boost and look-ahead doubles; both return to base on release.
7. After visiting at least one career planet, a soft cyan additive beam appears at the most recently visited planet, pointing toward the next unvisited stop in route order.
8. When the next stop is off-camera, a screen-edge chevron + distance pill appears at the closest viewport edge; it hides as soon as the next stop enters the viewport.
9. Skipping ahead (e.g., visiting Earth before Saturn) leaves the projection coherent: `nextTarget` is the first unvisited in route order (Saturn), anchor is the planet just entered (Earth). The beam updates accordingly.
10. The three filler planets (Mercury, Uranus, Neptune) render at their off-axis positions, are solid (the ship cannot enter their bodies), but produce no proximity reveal, no info panel, and no waypoint targeting.
11. No `@ts-ignore`, postfix `!`, `as` casts on lookups, `eslint-disable` / `oxlint-disable` comments, or other suppressor patterns introduced.
12. No new `useEffect` outside the existing composition root patterns.

---

## Open Risks

- **Boost auto-cut feels abrupt at planet entry.** Mitigation: the `factor` lerp at rate ~6 /sec ramps the visual transition over ~170 ms, so even though `boostActive` flips instantly, the trail cross-fade and FOV / look-ahead lifts ease out. If the integrator's velocity step still reads as a jolt during playtest, the integrator can clamp the per-frame target-velocity delta independently — addressed in implementation if observed.
- **Activation overlap at high speeds.** Even with ≥70-unit center spacing, a player crossing two activation zones in a single frame at boost speed could fire `entered_proximity` for two planets in the same tick. The FSM handles this correctly (both ids land in `visited`), but the reveal panel will show whichever id won the iteration order. Playtest will tell whether this matters; the fix, if needed, is to suppress reveal transitions on the secondary entry in a single tick — a same-tick coalescing rule in `ProximityWatcher`, not a layout change.
- **Asteroid shell intersecting the journey volume.** The shell sits at radius 280 around the origin; at the journey midpoint the ship sees asteroids on all sides. This may read as "I'm flying through an asteroid belt", which is actually appropriate. If it instead reads as crowding, the shell can be made camera-anchored in a follow-up — orthogonal to this spec.
- **Camera far-plane precision.** Bumping `far` to 800 with the existing `near` of 0.1 keeps the depth-buffer ratio at 8000:1 — Three.js still has plenty of precision at the sun's distance. No log-depth needed.

---

## Out of Scope (Explicit)

- Auto-pilot / click-to-fly navigation menu. Designed to be additive on top of this spec — a future feature can add a `?target=` URL param and an `autopilot { targetId }` FSM mode without touching the route projection or visited tracking shipped here.
- Persistence of visited state across reloads (URL or storage).
- A "tour complete" reveal at the sun.
- Re-tuning of any chase-cam / ship physics constants beyond the explicit boost-driven lifts on FOV and look-ahead.
