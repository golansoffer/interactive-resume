# Earth Moon — Design

**Date:** 2026-05-23
**Scope:** Add a single orbiting moon to the Earth planet (StreamElements / `earth_b`) in the 3D scene. The data shape is extensible so adding moons to other planets later is pure config — no new code. Moon is visual-only: it does not block the ship, does not contribute to proximity activation, and carries no label or visual effects (no pulse, no rim).

---

## Goal

The `Planet` system today renders a single body per company entry and per filler entry. There is no concept of satellites — moons, rings-as-bodies, or any orbiting child. Earth has an obvious real-world referent (the Moon) and the `moon_a` / `moon_b` GLBs already exist in `planetAssets.ts` but are unused inventory.

This spec adds:

1. **Data shape for satellites** that hangs off a placed planet, defaulting to an empty array — so existing planets are unchanged in behavior and the door is open to give Mars two moons, Jupiter the four Galileans, etc., later, by editing data only.
2. **One moon for Earth** with parameters chosen for legibility at the existing scene scale.
3. **An orbit primitive** (pure function) in services + a new `<Satellite>` component sibling to `<Planet>`.

## Non-goals

- **No moons for other planets yet.** Field is added, every existing entry gets `satellites: []`. Other planets are out of scope for this pass.
- **No collider.** Moon does not block the ship — it passes through. (Decision: user-selected. The collider registry would have to update per frame for an orbiting body; cheap to do but adds responsibility the moon doesn't need for the visual goal.)
- **No proximity activation contribution.** Earth's StreamElements reveal is unaffected by the moon's position.
- **No label.** Moons do not get a `PlanetLabel` overlay. Labels are a company-reveal cue; a "Moon" label would clutter without informing.
- **No visual effects.** Moon uses `{ kind: 'plain' }` look — no pulse breathing, no rim glow, no atmosphere shader. It is quiet relative to the company planets. This falls out for free: `resolvePlanetLook('moon_a')` already returns `plain` because `moon_a` is unmapped in `PLANET_LOOK`.
- **No new lighting.** Reuses the scene's existing ambient + two directional lights.
- **No `FillerPlanetEntry` satellites.** Field is scoped to `PlanetConfig` (used by `CompanyEntry.planet`). Fillers stay as-is; if a filler ever needs a moon, the field is trivially added then.
- **No state-machine changes.** Purely additive visual. `sceneMachine` is untouched.
- **No URL state.** Moon position is derived from time + orbit params; not bookmarkable.

---

## Architecture

### Layer placement

```
features/scene/
├── types/
│   └── satellite.ts                              — NEW: SatelliteSpec, SatelliteOrbit
├── services/
│   └── renderer/
│       ├── satelliteOffset.ts                    — NEW: pure (orbit, time) → [x,y,z]
│       ├── satelliteOffset.test.ts               — NEW: unit tests
│       ├── phaseFromId.ts                        — NEW: lifted from Planet.tsx; pure (id) → number
│       ├── phaseFromId.test.ts                   — NEW: unit tests
│       └── planetScale.ts                        — NEW: holds PLANET_BASE_SCALE shared by Planet and Satellite
├── components/
│   └── Scene/
│       ├── Satellite.tsx                         — NEW: renders one orbiting body
│       ├── Satellite.test.tsx                    — NEW
│       ├── usePlanetVisual.ts                    — NEW: component-private hook (see placement note below)
│       └── usePlanetVisual.test.ts               — NEW
```

**Placement note — `usePlanetVisual.ts`:** Lives in `components/Scene/`, not `services/renderer/`. Reason: it returns memoised values from `useGLTF` / `useTexture` — React-coupled outputs. The `services/` rule "pure callbacks; no React" forbids it there. The `components/` placement matches today's `Planet.tsx`, which performs the same GLB+texture+plan setup inline as a component-private prelude. The new hook extracts that pattern without changing its layer.

**Placement note — `planetScale.ts`:** `PLANET_BASE_SCALE` is currently a module-scope constant in `Planet.tsx`. Both `Planet` and `Satellite` consume it. Per Iron Law 1 (no sub-layer leak between components in `components/Scene/`), a constant shared by two components belongs in a port — here, a pure-services file. `Planet.tsx` and `Satellite.tsx` both import from `services/renderer/planetScale.ts`.

Touch points in existing files:

```
features/scene/types/planet.ts
  — PlanetConfig gains required `satellites: ReadonlyArray<SatelliteSpec>`

features/scene/widget/scene/companies.ts
  — every CAREER_ROUTE entry gains `satellites: []`
  — streamelements (earth_b) entry gains a one-element satellites array (the Moon)

features/scene/components/Scene/Planet.tsx
  — props gain `satellites: ReadonlyArray<SatelliteSpec>`
  — refactored to delegate the GLB→plan→pose pipeline to usePlanetVisual
  — module-scope `phaseFromId` (+ its `idEncoder`) and `PLANET_BASE_SCALE` are removed; replaced with imports from services
  — outer placement group renders `{satellites.map(...) => <Satellite />}` as sibling of the mesh group

features/scene/components/Scene/Companies.tsx
  — passes `satellites={entry.planet.satellites}` to <Planet>

features/scene/components/Scene/FillerPlanets.tsx
  — passes `satellites={[]}` to <Planet> (explicit empty, no default — Iron Law 3)
```

### Dependency rule

```
Companies / FillerPlanets → Planet → Satellite
                                   → usePlanetVisual (shared GLB+plan+pose hook)
Satellite → usePlanetVisual
          → satelliteOffset (pure orbit math)
```

No layer reaches across. `Satellite` does not see colliders, activations, proximity, route projections, or sceneState — its props forbid it. `Planet` does not see orbit math — that lives entirely inside `Satellite` and `satelliteOffset`. `Companies` / `FillerPlanets` pass `satellites` through without inspecting; they don't know what a satellite is structurally.

---

## Types & data shape

### `types/satellite.ts`

```ts
import type { PlanetAssetId } from './planet';

export type SatelliteOrbit = {
  readonly radius: number;          // world units from parent center
  readonly periodSeconds: number;   // time for one full revolution
  readonly phase: number;           // starting angle, radians (0..2π)
  readonly inclinationDeg: number;  // tilt of orbit plane from xz, degrees
};

export type SatelliteSpec = {
  // id is BOTH the React render key AND the phase seed for own-axis rotation
  // (the orbit position derives from time + orbit params only; the rotation phase
  // derives from id via phaseFromId). Renaming a satellite re-phases its spin.
  readonly id: string;
  readonly assetId: PlanetAssetId;
  readonly scale: number;           // multiplier on PLANET_BASE_SCALE (e.g. 0.3 for a small moon)
  readonly orbit: SatelliteOrbit;
};
```

### `types/planet.ts` change

```ts
export type PlanetConfig = {
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
  readonly satellites: ReadonlyArray<SatelliteSpec>;   // [] means "no moons"
};
```

### Earth's moon — concrete values

In `widget/scene/companies.ts`, the StreamElements entry's `planet` block becomes:

```ts
planet: {
  assetId: 'earth_b',
  placement: [-10, 0, 400],
  satellites: [
    {
      id: 'earth_b:moon',
      assetId: 'moon_a',
      scale: 0.3,
      orbit: { radius: 14, periodSeconds: 10, phase: 0, inclinationDeg: 30 },
    },
  ],
},
```

All four other entries get `satellites: []`.

---

## Visual & motion

### Orbit parameters (rationale)

- `radius: 14` — Earth renders at `PLANET_BASE_SCALE = 1.5` with a body radius extracted from the GLB (typically ~1.5–2.0 in source units, so ~2.25–3.0 world units after scale). A radius of 14 sits cleanly outside the body and gives the moon enough room to read as a distinct orbiting object that sweeps in front of and behind Earth from the player's viewpoint.
- `periodSeconds: 10` — matches the "close & steady" feel. Fast enough that the orbit reads as motion in any single moment looking at Earth (~36 degrees per second). Slow enough not to look like a centrifuge.
- `phase: 0` — places the moon directly behind Earth (+Z) at scene start, so the first visible motion is a sweep out to the side. Matters only when adding multiples (Phobos+Deimos, etc.).
- `inclinationDeg: 30` — tilts the orbit so the bulk of the secondary motion is side-to-side (X) with a gentle vertical lift (Y); the moon's primary motion is front-back (Z), reading as a comet-like transit past Earth from the player's viewpoint. 45° would split the secondary swing equally between X and Y and read as a tilted vertical ring instead of a diagonal flyby; 0° would be a flat horizontal ring with no vertical interest.

### Visual treatment

- `scale: 0.3` — the moon is ~30% of Earth's apparent size. Reads as a satellite, not a sibling.
- `look = { kind: 'plain' }` — no pulse, no rim, no atmosphere. Free via `resolvePlanetLook('moon_a')`.
- Own-axis rotation: same `rotationRateFor(phase)` helper used by `Planet`, applied to the moon mesh. The moon spins on its own axis while orbiting Earth.
- No sway, no scale-breath, no activation scaling. These belong to company planets.

### Orbit math

`services/renderer/satelliteOffset.ts`:

```ts
import type { SatelliteOrbit } from '../../types/satellite';

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

export const satelliteOffset = (
  orbit: SatelliteOrbit,
  timeSeconds: number,
): readonly [number, number, number] => {
  const angle = (timeSeconds / orbit.periodSeconds) * TWO_PI + orbit.phase;
  const inclination = orbit.inclinationDeg * DEG_TO_RAD;
  const z = Math.cos(angle) * orbit.radius;
  const planar = Math.sin(angle) * orbit.radius;
  const x = planar * Math.cos(inclination);
  const y = planar * Math.sin(inclination);
  return [x, y, z];
};
```

Pure function. No Three, no React. Mirrors the style of existing pure helpers (`planetPose`, `clampOutOfSphere`, `celestialFlightMath`).

---

## Component & scene-graph structure

### `usePlanetVisual` (shared hook)

Extracted from the current `Planet.tsx` body — the GLB+plan+pose pipeline:

```ts
// components/Scene/usePlanetVisual.ts
type PlanetVisualBundle = {
  readonly plan: PlanetVisualPlan;
  readonly pose: PlanetPose;
  readonly extraction: BodyExtraction;
};

export const usePlanetVisual = (
  assetId: PlanetAssetId,
  phase: number,
): PlanetVisualBundle;
```

Internally: `useGLTF` + `useTexture` + `configureColorsheet` + `resolvePlanetLook` + `buildVisualPlan(cloneAndDress(...))` + `extractBody` + `planetPoseFor`. Same as Planet does today.

**Why extract:** Two callers (`Planet`, `Satellite`) of the identical setup is exactly when extraction earns its place (Iron Law 4). Without it, the Satellite component duplicates ~25 lines of GLB+plan plumbing. The hook collapses both to one source of truth.

`Planet.tsx` becomes shorter — `usePlanetFrame` and the collider/activation/proximity wiring stay; the GLB+plan setup is now one hook call.

### `Satellite` component

```tsx
// components/Scene/Satellite.tsx
type SatelliteProps = {
  readonly spec: SatelliteSpec;
};

export const Satellite = (props: SatelliteProps): JSX.Element => {
  const phase = useMemo(() => phaseFromId(props.spec.id), [props.spec.id]);
  const { plan, pose } = usePlanetVisual(props.spec.assetId, phase);
  const rotationRate = useMemo(() => rotationRateFor(phase), [phase]);
  const groupRef = useRef<Group | null>(null);
  const meshRef = useRef<Object3D | null>(null);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (group === null || mesh === null) return;
    const [x, y, z] = satelliteOffset(props.spec.orbit, state.clock.elapsedTime);
    group.position.set(x, y, z);
    mesh.rotation.y += rotationRate * delta;
  });

  return (
    <group ref={groupRef}>
      <group ref={meshRef} scale={props.spec.scale * PLANET_BASE_SCALE}>
        <group quaternion={pose.alignQuaternion}>
          <Center>
            <primitive object={plan.scene} />
          </Center>
        </group>
      </group>
    </group>
  );
};
```

`phaseFromId` is currently a private helper in `Planet.tsx`. It moves to `services/renderer/phaseFromId.ts` — own file matching its export name (consistent with `planetPose.ts` / `planetCollider.ts`). The lift preserves the module-scope `TextEncoder` allocation (one encoder per process, allocated once at import time) and carries across a one-line comment explaining the function's purpose: deriving a deterministic per-id phase so animation cycles desync across bodies sharing the same period. Both `Planet` and `Satellite` import it.

`PLANET_BASE_SCALE` similarly moves out of `Planet.tsx` into `services/renderer/planetScale.ts` (a single-export module: `export const PLANET_BASE_SCALE = 1.5;`). `Planet` and `Satellite` both import it. Per Iron Law 1, a constant shared by two sibling components belongs in a port, not in one of the components.

`rotationRateFor` already lives in `planetVisualPlan` and is exported — no move needed.

### Scene-graph mounting

In `Planet.tsx`:

```tsx
return (
  <group position={props.placement}>
    <group ref={meshRef}>
      <group quaternion={derived.pose.alignQuaternion}>
        <Center>
          <primitive object={plan.scene} />
        </Center>
      </group>
    </group>
    {props.satellites.map((spec) => (
      <Satellite key={spec.id} spec={spec} />
    ))}
  </group>
);
```

The satellite sits in the **outer placement group** — orbits the parent's center, not the swaying mesh. The planet's tiny sway should not drag the moon.

---

## Strict alignment with Iron Laws

**Law 1 — Hexagonal architecture.**
- `types/satellite.ts` is pure data (no React, no Three, no DOM).
- `services/renderer/satelliteOffset.ts` is pure math (no React, no Three).
- `components/Scene/Satellite.tsx` is a React adapter that bridges the pure orbit math to `@react-three/fiber`'s `useFrame`.
- Dependency direction: `Satellite → usePlanetVisual → primitives`; `Satellite → satelliteOffset → types`. No cross-layer reach.
- Litmus: swap Three for another 3D library — `satelliteOffset` and `SatelliteSpec` survive unchanged. ✓

**Law 2 — Discriminated unions everywhere.**
- `SatelliteSpec` and `SatelliteOrbit` are flat config records with no variants — same shape pattern as the existing `PlanetConfig` and `FillerPlanetEntry`. A `kind: 'circular'` discriminator on `SatelliteOrbit` would be a 1-variant union, which Law 4 rejects (no abstraction without earning its place).
- The visual treatment uses the existing `PlanetLook` union, folding to `{ kind: 'plain' }` for the moon — reuses, does not duplicate.

**Law 3 — Make illegal states unrepresentable.**
- `satellites` is required on `PlanetConfig`, not optional. Empty array means "no moons" — not optional-as-state.
- No nullable fields anywhere in `SatelliteSpec` / `SatelliteOrbit`.
- No `?` on Planet's new `satellites` prop. `FillerPlanets` passes `[]` explicitly.
- No "should never happen" branches in `satelliteOffset` (pure trig over typed numbers).
- Numbers are unconstrained — same trust model as `PlanetLook`'s `amplitude` / `frequencyHz`. Author-controlled config, not parsed input. No runtime guards.

**Law 4 — Solve more with less.**
- New `<Satellite>` component instead of a `kind: 'satellite'` branch on `<Planet>` — separate responsibility (no collider, no activation, no proximity, no sway, no breath). Branching Planet would mean defensive null-skips on every wiring path.
- `usePlanetVisual` hook extracted from `Planet` because two callers of the identical pipeline is exactly when extraction earns its place. Adds one file, deletes ~25 lines of duplication potential.
- `satellites: ReadonlyArray<SatelliteSpec>` field on `PlanetConfig` adds one required line per existing entry. Payoff: adding moons to other planets later is pure data.
- No "OrbitType" plugin interface, no `Orbit` strategy class, no "satellite factory."

**Supporting rules.**
- **Parse, don't validate:** Satellite config is hardcoded TypeScript literals, type-checked at compile time. No runtime parsing needed.
- **Functional:** `satelliteOffset` is pure. `Satellite` mutates only the Three.js group/mesh refs inside `useFrame` — same pattern as `Planet`'s `usePlanetFrame`. The mutation is the externality bridge for the render loop, contained at the component edge.
- **Early returns:** `useFrame` body guards on `group === null || mesh === null` first.
- **No useEffect:** Component uses `useFrame` (the established render-loop bridge in this codebase), not raw `useEffect`. Same pattern as `Planet.tsx`.
- **Naming:** `camelCase` (`satelliteOffset`, `usePlanetVisual`), `PascalCase` (`Satellite`, `SatelliteSpec`, `SatelliteOrbit`). No `snake_case` strings introduced (no new `kind` variants).
- **No information leaks:** `Satellite`'s `SatelliteProps` carries one prop — `spec`. It cannot see colliders, activations, proximity, scene state, or route projections. The type forbids it.
- **Deep modules:** `Satellite` has one prop and one responsibility (render an orbiting body). `satelliteOffset` has two parameters and one return value. `usePlanetVisual` has two parameters and one returned bundle. No 6+-parameter lists.
- **Comments:** Only where the *why* is non-obvious — the dual-role comment above `SatelliteSpec.id` (render key + phase seed; renaming re-phases the spin), the `// [] means "no moons"` line on `PlanetConfig.satellites`, the phase-desync comment carried across to `phaseFromId.ts`. No what-comments.

---

## Implementation phasing (agent pipeline)

This is a state-less, visual-only addition. State-machine-agent and route-url-adapter are skipped (no FSM changes, no URL state). The CLAUDE.md agent roster assigns the `services/` directory to `data-adapter-builder` — `satelliteOffset.ts` and `phaseFromId.ts` are services files even though they're pure math (no I/O), so they go through that agent per the directory rule.

Sequenced pipeline:

1. **`bdd-tdd-spec-writer`** — produces port-targeted Gherkin and TDD bullets covering: orbit math, satellite rendering, Planet props change, Companies/FillerPlanets wiring.
2. **`core-architecture-guardian` (plan mode)** — validates the type design (`SatelliteSpec`, `SatelliteOrbit`, `PlanetConfig` change) against the dependency rule and the no-info-leak rule.
3. **`data-adapter-builder`** — creates the three new services files: `services/renderer/satelliteOffset.ts` (with tests), `services/renderer/phaseFromId.ts` (lifted from `Planet.tsx`, with tests), `services/renderer/planetScale.ts` (single-export module for `PLANET_BASE_SCALE`). Also creates `types/satellite.ts`, modifies `types/planet.ts` (adds `satellites` to `PlanetConfig`), and edits `widget/scene/companies.ts` to add `satellites: []` to all entries plus the Earth moon spec.
4. **`ui-component-builder`** — creates `usePlanetVisual.ts` and `Satellite.tsx` (with tests), refactors `Planet.tsx` to consume `usePlanetVisual`, `phaseFromId`, and `PLANET_BASE_SCALE` from services (removing the local `phaseFromId`, `idEncoder`, and `PLANET_BASE_SCALE`), threads `satellites` props through `Companies.tsx` and `FillerPlanets.tsx`.
5. **`styles-motion`** — owns the orbit motion: tuning the orbit parameters in `companies.ts` for visual feel, validating the rotation rate, confirming the inclination value reads as 3D.
6. **`core-architecture-guardian` (code mode)** — verifies the realized code holds the dependency rule and no-leak rule.
7. **`rules-guardian`** — final audit against all four Iron Laws and the supporting rules.

Every subagent prompt explicitly forbids creating worktrees (per `feedback_subagent_no_worktree` in user memory). No commits/pushes (per `feedback_no_commits_no_pushes`).

---

## Testing

**Unit (pure):**

- `satelliteOffset.test.ts`:
  - `timeSeconds = 0, phase = 0, inclinationDeg = 0, radius = R` → `[0, 0, R]` (moon starts behind the planet on the +Z depth axis).
  - `timeSeconds = periodSeconds / 4, phase = 0, inclinationDeg = 0, radius = R` → `[R, 0, 0]` (moon swings sideways into +X) (within float tolerance).
  - `timeSeconds = periodSeconds / 2, phase = 0, inclinationDeg = 0, radius = R` → `[0, 0, -R]` (moon is in front of the planet on -Z).
  - `inclinationDeg = 90` collapses `x` toward 0 and sends `planar` into `y` (orbit lies in the YZ plane).
  - `phase = π` at `timeSeconds = 0` produces the same offset as `phase = 0` at `timeSeconds = periodSeconds / 2`.

**Component:**

- `Satellite.test.tsx`:
  - Mounts the GLB for `spec.assetId`.
  - Applies `spec.scale * PLANET_BASE_SCALE` to the mesh group.
  - Reads `satelliteOffset` in `useFrame` and applies it to the group's position. (Verified via spy on `useFrame` callback semantics, mirroring `Planet.test.tsx` patterns.)

- `usePlanetVisual.test.ts`:
  - Returns `plan`, `pose`, `extraction` for a valid asset id.
  - Memoizes — same inputs yield stable references.

**Integration:**

- Extend `Planet.test.tsx`:
  - Passing `satellites: []` renders no satellite groups.
  - Passing `satellites: [oneSpec]` renders one `<Satellite>` child inside the placement group, as a sibling of the mesh group.

- Extend `Scene.test.tsx` (light smoke):
  - With the current `CAREER_ROUTE` (Earth has one moon, others have none), the scene mounts without error and the moon GLB is among the loaded primitives.

  No dedicated `Companies.test.tsx` / `FillerPlanets.test.tsx` exists today — the `Planet.test.tsx` extension above covers the threaded-prop behavior at the right layer.

**Regression:**

- All existing `Planet.test.tsx`, `Scene.test.tsx`, `FillerPlanets`-related tests continue to pass unchanged in behavior — the new `satellites: []` default does not alter any visual or collider output for non-moon entries.
