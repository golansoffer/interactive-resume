# Solar System Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-arrange the scene into a recognizable solar system, lay the five career planets along a single +Z tour route (Saturn = Mave → Venus = TGS), render Mercury / Uranus / Neptune as off-axis filler, add a Hold-Space boost with auto-cut on planet proximity, and guide the player with a 3D in-world beam + screen-edge HUD arrow.

**Architecture:** Pure data reshape with FSM-owned visited set. Adds one ref (`BoostSignal`), one `Intent` variant (`'boost'`), one integrator parameter (`multiplier: 1 | 3`), one FSM context field (`visited: ReadonlyArray<CompanyId>`), one projection (`RouteProjection`), and a Planet mode discriminator (`PlanetMode = active | filler`). All cross-layer flows carry discriminated unions; no optional fields used as flags.

**Tech Stack:** React 19, React Three Fiber 9, drei 10, three 184, xstate 5, vitest, oxlint. Project rules: hexagonal layering, discriminated unions, illegal states unrepresentable, no type-system suppressors. See `docs/superpowers/specs/2026-05-21-solar-system-tour-design.md` for the design source of truth.

---

## File Structure Overview

```
src/
├── core/scene/
│   ├── sceneMachine.ts                       (modify) +visited array, +reducer rule
│   └── sceneMachine.test.ts                  (modify) +visited tests
│
├── features/scene/
│   ├── types/
│   │   ├── intent.ts                         (modify) +'boost' variant
│   │   ├── route-projection.ts               (create) RouteProjection union
│   │   └── planet-mode.ts                    (create) PlanetMode union
│   │
│   ├── services/
│   │   ├── input/
│   │   │   ├── subscribeToKeyboard.ts        (modify) Space → continuous 'boost'
│   │   │   └── subscribeToKeyboard.test.ts   (modify) replace 'unbound' block with boost block
│   │   └── renderer/
│   │       ├── integrateMotion.ts            (modify) +multiplier: 1 | 3 param
│   │       └── integrateMotion.test.ts       (modify) +explicit multiplier in every call + boost tests
│   │
│   ├── widget/scene/
│   │   ├── companies.ts                      (modify) new placements + CAREER_ROUTE_ORDER
│   │   ├── fillerPlanets.ts                  (create) FILLER_PLANETS list
│   │   ├── projectRoute.ts                   (create) pure (visited, entries) → RouteProjection
│   │   ├── projectRoute.test.ts              (create)
│   │   └── useScene.ts                       (modify) expose routeProjection
│   │
│   └── components/Scene/
│       ├── useSceneRefs.ts                   (modify) +anyActive, +BoostSignal, export factories
│       ├── useSceneRefs.test.ts              (modify) +PlanetActivations + BoostSignal tests
│       ├── Scene.tsx                         (modify) +routeProjection prop, +FillerPlanets, +Waypoint*
│       ├── Planet.tsx                        (modify) PlanetMode discriminated prop
│       ├── Sun.tsx                           (modify) SUN_POSITION → (0, 0, 560)
│       ├── FollowCamera.tsx                  (modify) far 500→800; +BoostSignal lifts
│       ├── Player.tsx                        (modify) boost wiring, two trails, multiplier
│       ├── FillerPlanets.tsx                 (create) renders filler list via <Planet mode=filler>
│       ├── WaypointBeam.tsx                  (create) 3D additive line + cuesFor pure switch
│       ├── WaypointBeam.test.ts              (create) cuesFor unit tests
│       ├── WaypointMarker.tsx                (create) <Html> screen-edge marker + targetFor switch
│       ├── WaypointMarker.ndc.ts             (create) projectToNdc / isInsideNdc / clampToEdge
│       └── WaypointMarker.test.ts            (create) targetFor / clampToEdge unit tests
│
└── features/scene/widget/scene/
    └── SceneWidget.tsx                       (modify) forward routeProjection to <Scene>
```

Each task ends with `pnpm check` green and one commit. Tasks are sequenced so the build stays green at every commit.

---

## Task 1: Add `boost` intent variant + multiplier param on `integrateMotion`

**Files:**
- Modify: `src/features/scene/types/intent.ts`
- Modify: `src/features/scene/services/renderer/integrateMotion.ts`
- Modify: `src/features/scene/services/renderer/integrateMotion.test.ts`
- Modify: `src/features/scene/components/Scene/Player.tsx:169-174` (single integrateMotion call)

- [ ] **Step 1: Extend `Intent` with the `boost` variant**

In `src/features/scene/types/intent.ts`, change:

```ts
export type Intent =
  | { readonly kind: 'move_forward' }
  | { readonly kind: 'move_backward' }
  | { readonly kind: 'strafe_left' }
  | { readonly kind: 'strafe_right' };
```

to:

```ts
export type Intent =
  | { readonly kind: 'move_forward' }
  | { readonly kind: 'move_backward' }
  | { readonly kind: 'strafe_left' }
  | { readonly kind: 'strafe_right' }
  | { readonly kind: 'boost' };
```

- [ ] **Step 2: Write the failing multiplier tests**

In `src/features/scene/services/renderer/integrateMotion.test.ts`, add a new `describe` block at the bottom of the file (after the existing `describe('integrateMotion — purity', ...)`):

```ts
describe('integrateMotion — boost multiplier', () => {
  it('with multiplier=1, behavior is identical to the un-boosted baseline (no regression on existing math)', () => {
    const dt = 1 / 60;
    let stateMul1: Kinematics = ZERO;
    let stateMul1Again: Kinematics = ZERO;
    for (let i = 0; i < 30; i += 1) {
      stateMul1 = integrateMotion(stateMul1, intents('move_forward'), dt, AXIS_BASIS, 1);
      stateMul1Again = integrateMotion(stateMul1Again, intents('move_forward'), dt, AXIS_BASIS, 1);
    }
    expect(stateMul1).toEqual(stateMul1Again);
    expect(magnitude(stateMul1.velocity)).toBeCloseTo(MAX_SPEED, 5);
  });

  it('with multiplier=3 and full-forward intent, velocity converges to MAX_SPEED × 3 along forward', () => {
    const dt = 1 / 60;
    let state: Kinematics = ZERO;
    const timeToMax = (MAX_SPEED * 3) / ACCELERATION;
    const frames = Math.ceil(timeToMax / dt) + 2;
    for (let i = 0; i < frames; i += 1) {
      state = integrateMotion(state, intents('move_forward'), dt, AXIS_BASIS, 3);
    }
    expect(magnitude(state.velocity)).toBeCloseTo(MAX_SPEED * 3, 5);
    expect(state.velocity.z).toBeCloseTo(MAX_SPEED * 3, 5);
  });

  it('with multiplier=3 and no intents, decelerates as if no input (multiplier scales target, not deceleration)', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 0, y: 0, z: 10 } };
    const result = integrateMotion(state, intents(), 0.016, AXIS_BASIS, 3);
    const step = DECELERATION * 0.016;
    expect(result.velocity.z).toBeCloseTo(10 - step, 10);
  });
});
```

The existing 26 calls to `integrateMotion(...)` in this file must also be updated to include the multiplier — do that in Step 4, after the signature change makes them fail to compile.

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `pnpm test src/features/scene/services/renderer/integrateMotion.test.ts`

Expected: typecheck fails because `integrateMotion` currently takes 4 args, not 5.

- [ ] **Step 4: Widen `integrateMotion`'s signature and propagate**

In `src/features/scene/services/renderer/integrateMotion.ts`, change the exported function to:

```ts
export const integrateMotion = (
  state: Kinematics,
  intents: ReadonlySet<Intent['kind']>,
  dt: number,
  basis: CameraBasis,
  multiplier: 1 | 3,
): Kinematics => {
  const direction = desiredDirection(intents, basis);
  const targetVelocity: Vec3 = {
    x: direction.x * MAX_SPEED * multiplier,
    y: direction.y * MAX_SPEED * multiplier,
    z: direction.z * MAX_SPEED * multiplier,
  };
  const pushing = intents.size > 0 && (direction.x !== 0 || direction.y !== 0 || direction.z !== 0);
  const rate = pushing ? ACCELERATION : DECELERATION;
  const velocity = snapVelocity(state.velocity, targetVelocity, rate, dt);
  const position: Vec3 = {
    x: state.position.x + velocity.x * dt,
    y: state.position.y + velocity.y * dt,
    z: state.position.z + velocity.z * dt,
  };
  return { position, velocity, heading: state.heading };
};
```

Update every existing call in `integrateMotion.test.ts` to pass `1` as the final argument. Each call currently ends with `..., AXIS_BASIS)` or `..., ROTATED_BASIS)`. Use a search-and-replace:

- `, AXIS_BASIS)` → `, AXIS_BASIS, 1)`
- `, ROTATED_BASIS)` → `, ROTATED_BASIS, 1)`

(There are no remaining bare `)` integrator calls in this file — every existing call ends with one of those two bases.)

- [ ] **Step 5: Update the Player.tsx call site to pass `1`**

In `src/features/scene/components/Scene/Player.tsx`, find lines 169-174:

```ts
const integrated = integrateMotion(
  props.kinematicsRef.current,
  props.intents.current,
  delta,
  basis,
);
```

Change to:

```ts
const integrated = integrateMotion(
  props.kinematicsRef.current,
  props.intents.current,
  delta,
  basis,
  1,
);
```

(Task 13 will replace `1` with the actual computed multiplier.)

- [ ] **Step 6: Run the full check**

Run: `pnpm check`

Expected: typecheck, lint, suppressor scan, and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/scene/types/intent.ts \
        src/features/scene/services/renderer/integrateMotion.ts \
        src/features/scene/services/renderer/integrateMotion.test.ts \
        src/features/scene/components/Scene/Player.tsx
git commit -m "$(cat <<'EOF'
feat(scene): boost intent variant + multiplier on integrateMotion

Intent gains 'boost'. integrateMotion takes multiplier: 1 | 3 (literal union
prevents any other value at the call site). Player passes 1 today; task 13
will route the gated multiplier through.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Bind `Space` to continuous `boost` intent

**Files:**
- Modify: `src/features/scene/services/input/subscribeToKeyboard.ts`
- Modify: `src/features/scene/services/input/subscribeToKeyboard.test.ts`

- [ ] **Step 1: Rewrite the failing test**

In `src/features/scene/services/input/subscribeToKeyboard.test.ts`, find the `describe('Space — unbound after switching to camera-relative controls', ...)` block (around lines 132-138). Replace the entire block with:

```ts
describe('Space — boost intent', () => {
  it("invokes onSignal with { kind: 'intent_down', intent: 'boost' } when Space is pressed", () => {
    target.dispatchEvent(keyDownEvent({ code: 'Space' }));
    expect(onSignal).toHaveBeenCalledTimes(1);
    expect(onSignal).toHaveBeenCalledWith({ kind: 'intent_down', intent: 'boost' });
  });

  it("invokes onSignal with { kind: 'intent_up', intent: 'boost' } when Space is released", () => {
    target.dispatchEvent(keyDownEvent({ code: 'Space' }));
    onSignal.mockClear();
    target.dispatchEvent(keyUpEvent({ code: 'Space' }));
    expect(onSignal).toHaveBeenCalledTimes(1);
    expect(onSignal).toHaveBeenCalledWith({ kind: 'intent_up', intent: 'boost' });
  });

  it('invokes onSignal only once with intent_down for Space when keydown is followed by OS auto-repeat keydown events', () => {
    target.dispatchEvent(keyDownEvent({ code: 'Space' }));
    target.dispatchEvent(keyDownEvent({ code: 'Space', repeat: true }));
    target.dispatchEvent(keyDownEvent({ code: 'Space', repeat: true }));
    const downCalls = onSignal.mock.calls.filter(
      ([signal]) => signal.kind === 'intent_down' && signal.intent === 'boost',
    );
    expect(downCalls).toHaveLength(1);
  });

  it('does not invoke onSignal when Shift+Space is pressed (modifier-key chord)', () => {
    target.dispatchEvent(keyDownEvent({ code: 'Space', shiftKey: true }));
    expect(onSignal).not.toHaveBeenCalled();
  });
});
```

Add `boost` to the lists of continuous-key cases in the two existing `describe` blocks (`continuous keys — intent_down on press` around line 68, and `continuous keys — intent_up on release` around line 89). In each block, append to the `cases` array:

```ts
{ code: 'Space', intent: 'boost' },
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/scene/services/input/subscribeToKeyboard.test.ts`

Expected: the new Space tests fail (`onSignal` not called).

- [ ] **Step 3: Bind Space in the keyboard adapter**

In `src/features/scene/services/input/subscribeToKeyboard.ts`, find the `classify` function (lines 9-30). Add a new case before `case 'KeyE':`:

```ts
    case 'Space':
      return { kind: 'continuous', intent: 'boost' };
```

The full updated `classify` should look like:

```ts
const classify = (code: string): KeyClassification => {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      return { kind: 'continuous', intent: 'move_forward' };
    case 'KeyS':
    case 'ArrowDown':
      return { kind: 'continuous', intent: 'move_backward' };
    case 'KeyA':
    case 'ArrowLeft':
      return { kind: 'continuous', intent: 'strafe_left' };
    case 'KeyD':
    case 'ArrowRight':
      return { kind: 'continuous', intent: 'strafe_right' };
    case 'Space':
      return { kind: 'continuous', intent: 'boost' };
    case 'KeyE':
      return { kind: 'discrete', command: { kind: 'interact' } };
    case 'Escape':
      return { kind: 'discrete', command: { kind: 'pause_toggle' } };
    default:
      return { kind: 'unmapped' };
  }
};
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/services/input/subscribeToKeyboard.ts \
        src/features/scene/services/input/subscribeToKeyboard.test.ts
git commit -m "$(cat <<'EOF'
feat(scene): bind Space to continuous boost intent

Keyboard adapter maps Space (no modifiers) to a continuous boost intent.
Shift+Space remains a no-op (modifier chord rule). Auto-repeat suppression
applies — one intent_down per hold.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `anyActive()` to `PlanetActivations` + export factory

**Files:**
- Modify: `src/features/scene/components/Scene/useSceneRefs.ts`
- Modify: `src/features/scene/components/Scene/useSceneRefs.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/features/scene/components/Scene/useSceneRefs.test.ts`, add a new import beside the existing `createSphereColliders` import:

```ts
import { createPlanetActivations, createSphereColliders } from './useSceneRefs';
```

Then add a new `describe` block after the existing one:

```ts
describe('createPlanetActivations', () => {
  const mave = asCompanyId('mave');
  const eightfig = asCompanyId('8fig');

  it('isActive(id) is false for any id before any publish call', () => {
    const activations = createPlanetActivations();
    expect(activations.isActive(mave)).toBe(false);
  });

  it('isActive(id) is true after publish with that id in the set', () => {
    const activations = createPlanetActivations();
    activations.publish(new Set([mave]));
    expect(activations.isActive(mave)).toBe(true);
    expect(activations.isActive(eightfig)).toBe(false);
  });

  it('anyActive() returns false on a fresh registry', () => {
    const activations = createPlanetActivations();
    expect(activations.anyActive()).toBe(false);
  });

  it('anyActive() returns true after publish with any non-empty set', () => {
    const activations = createPlanetActivations();
    activations.publish(new Set([mave]));
    expect(activations.anyActive()).toBe(true);
  });

  it('anyActive() returns false after publish with an empty set', () => {
    const activations = createPlanetActivations();
    activations.publish(new Set([mave]));
    activations.publish(new Set<CompanyId>());
    expect(activations.anyActive()).toBe(false);
  });
});
```

Add the missing imports at the top of the file:

```ts
import { asCompanyId, type CompanyId } from '../../types/company';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/scene/components/Scene/useSceneRefs.test.ts`

Expected: typecheck fails — `createPlanetActivations` is not exported; `anyActive` is not a property of `PlanetActivations`.

- [ ] **Step 3: Export the factory and add `anyActive`**

In `src/features/scene/components/Scene/useSceneRefs.ts`, change the `PlanetActivations` type and its factory:

Before:
```ts
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
```

After:
```ts
export type PlanetActivations = {
  readonly isActive: (id: CompanyId) => boolean;
  readonly anyActive: () => boolean;
  readonly publish: (active: ReadonlySet<CompanyId>) => void;
};

export const createPlanetActivations = (): PlanetActivations => {
  let active: ReadonlySet<CompanyId> = new Set();
  return {
    isActive: (id) => active.has(id),
    anyActive: () => active.size > 0,
    publish: (next) => {
      active = next;
    },
  };
};
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/components/Scene/useSceneRefs.ts \
        src/features/scene/components/Scene/useSceneRefs.test.ts
git commit -m "$(cat <<'EOF'
feat(scene): PlanetActivations.anyActive — boost gating signal

PlanetActivations gains anyActive(): boolean. Producer-side reshape — the
boost gate in Player will read this instead of inspecting the registry size
through a leaked lookup.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `BoostSignal` ref to `useSceneRefs`

**Files:**
- Modify: `src/features/scene/components/Scene/useSceneRefs.ts`
- Modify: `src/features/scene/components/Scene/useSceneRefs.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/features/scene/components/Scene/useSceneRefs.test.ts`, extend the imports:

```ts
import { createBoostSignal, createPlanetActivations, createSphereColliders } from './useSceneRefs';
```

Add a new `describe` block:

```ts
describe('createBoostSignal', () => {
  it('read() returns { active: false, factor: 0 } before any write', () => {
    const signal = createBoostSignal();
    expect(signal.read()).toEqual({ active: false, factor: 0 });
  });

  it('write(true, 0.4) followed by read() returns { active: true, factor: 0.4 }', () => {
    const signal = createBoostSignal();
    signal.write(true, 0.4);
    expect(signal.read()).toEqual({ active: true, factor: 0.4 });
  });

  it('write(false, 0) returns the registry to the inert state', () => {
    const signal = createBoostSignal();
    signal.write(true, 1);
    signal.write(false, 0);
    expect(signal.read()).toEqual({ active: false, factor: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/scene/components/Scene/useSceneRefs.test.ts`

Expected: `createBoostSignal` is not exported.

- [ ] **Step 3: Implement the `BoostSignal` type, factory, and add to `SceneRefs`**

In `src/features/scene/components/Scene/useSceneRefs.ts`, append after `createSphereColliders`:

```ts
// Shared boost signal — Player writes (active, factor) once per frame from
// (intent + activation gate + smoothing); FollowCamera reads it for the FOV
// and look-ahead lifts. Two values cross the boundary: 'active' gates the
// integrator multiplier (binary) and 'factor' drives smooth visual lerps.
export type BoostSignal = {
  readonly read: () => { readonly active: boolean; readonly factor: number };
  readonly write: (active: boolean, factor: number) => void;
};

export const createBoostSignal = (): BoostSignal => {
  let active = false;
  let factor = 0;
  return {
    read: () => ({ active, factor }),
    write: (nextActive, nextFactor) => {
      active = nextActive;
      factor = nextFactor;
    },
  };
};
```

Extend `SceneRefs` and `useSceneRefs`:

Before:
```ts
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
```

After:
```ts
type SceneRefs = {
  readonly meshRef: RefObject<Object3D | null>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
  readonly boostSignalRef: RefObject<BoostSignal>;
};

export const useSceneRefs = (): SceneRefs => {
  const meshRef = useRef<Object3D | null>(null);
  const planetRadiiRef = useRef<PlanetRadii>(createPlanetRadii());
  const planetActivationsRef = useRef<PlanetActivations>(createPlanetActivations());
  const sphereCollidersRef = useRef<SphereColliders>(createSphereColliders());
  const boostSignalRef = useRef<BoostSignal>(createBoostSignal());
  return { meshRef, planetRadiiRef, planetActivationsRef, sphereCollidersRef, boostSignalRef };
};
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/components/Scene/useSceneRefs.ts \
        src/features/scene/components/Scene/useSceneRefs.test.ts
git commit -m "$(cat <<'EOF'
feat(scene): BoostSignal ref — bridge Player ↔ FollowCamera

Player writes (active, factor) per frame; FollowCamera reads factor for the
FOV / look-ahead lifts. Two-value registry, no React state churn.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Extend `sceneMachine` context with `visited` array

**Files:**
- Modify: `src/core/scene/sceneMachine.ts`
- Modify: `src/core/scene/sceneMachine.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/core/scene/sceneMachine.test.ts`, change the helper signature at the top (line 11):

```ts
type SceneOutcome = { readonly state: SceneState; readonly visited: ReadonlyArray<CompanyId> };

const runFromInitial = (events: ReadonlyArray<SceneMachineEvent>): SceneOutcome => {
  const actor = createActor(sceneMachine).start();
  for (const event of events) {
    actor.send(event);
  }
  const context = actor.getSnapshot().context;
  actor.stop();
  return { state: context.scene, visited: context.visited };
};
```

This changes the return type from `SceneState` to `SceneOutcome`. The existing tests will fail to compile because they `.toEqual({ kind: 'playing' })` etc. against the old shape.

Update every existing assertion in the file. There are 19 `expect(runFromInitial(...)).toEqual(...)` calls. Each compares against a scene state — change to compare against `.state`:

Search/replace pattern:
- `expect(runFromInitial(` → `expect(runFromInitial(`
- `)).toEqual({ kind:` → `).state).toEqual({ kind:`
- `)).toEqual({` for the paused-resumeTo cases similarly → `).state).toEqual({`

Each line becomes, e.g.:
```ts
expect(runFromInitial([]).state).toEqual({ kind: 'loading' });
expect(runFromInitial([{ type: 'start' }]).state).toEqual({ kind: 'playing' });
```

Then add a new describe block at the end of the file:

```ts
describe('sceneMachine — visited tracking', () => {
  it('starts with an empty visited array', () => {
    expect(runFromInitial([{ type: 'start' }]).visited).toEqual([]);
  });

  it('appends a new id to visited on entered_proximity', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
      ]).visited,
    ).toEqual([acme]);
  });

  it('appends multiple new ids in order', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'entered_proximity', objectId: globex },
      ]).visited,
    ).toEqual([acme, globex]);
  });

  it('moves an existing id to the end on re-entry (length unchanged, order updated)', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'entered_proximity', objectId: globex },
        { type: 'entered_proximity', objectId: acme },
      ]).visited,
    ).toEqual([globex, acme]);
  });

  it('exited_proximity does not modify visited', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'exited_proximity', objectId: acme },
      ]).visited,
    ).toEqual([acme]);
  });

  it('pause_toggle does not modify visited', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'pause_toggle' },
      ]).visited,
    ).toEqual([acme]);
  });

  it('start does not modify visited', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'start' },
      ]).visited,
    ).toEqual([acme]);
  });

  it('interact does not modify visited', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'interact' },
      ]).visited,
    ).toEqual([acme]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/core/scene/sceneMachine.test.ts`

Expected: typecheck fails — `context.visited` doesn't exist.

- [ ] **Step 3: Add `visited` to the FSM context and reducer**

In `src/core/scene/sceneMachine.ts`, change:

```ts
type SceneMachineContext = { readonly scene: SceneState };

const INITIAL_SCENE: SceneState = { kind: 'loading' };
```

to:

```ts
type SceneMachineContext = {
  readonly scene: SceneState;
  readonly visited: ReadonlyArray<CompanyId>;
};

const INITIAL_SCENE: SceneState = { kind: 'loading' };
const INITIAL_VISITED: ReadonlyArray<CompanyId> = [];

const reduceVisited = (
  visited: ReadonlyArray<CompanyId>,
  event: SceneMachineEvent,
): ReadonlyArray<CompanyId> => {
  if (event.type !== 'entered_proximity') return visited;
  const withoutId = visited.filter((id) => id !== event.objectId);
  return [...withoutId, event.objectId];
};
```

Change the `reduceAction` assignment from:

```ts
const reduceAction = machineSetup.assign({
  scene: ({ context, event }) => reduceScene(context.scene, event),
});
```

to:

```ts
const reduceAction = machineSetup.assign({
  scene: ({ context, event }) => reduceScene(context.scene, event),
  visited: ({ context, event }) => reduceVisited(context.visited, event),
});
```

Change the initial context:

```ts
context: { scene: INITIAL_SCENE, visited: INITIAL_VISITED },
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/core/scene/sceneMachine.ts src/core/scene/sceneMachine.test.ts
git commit -m "$(cat <<'EOF'
feat(core): sceneMachine context tracks visited career planets

Visited is an ordered, deduplicated array of CompanyId. entered_proximity
appends a new id or moves an existing id to the end. All other events
leave visited unchanged. Move-to-end semantics give the route projection
a stable 'anchor = last visited' rule.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create `RouteProjection` type + `projectRoute` pure function

**Files:**
- Create: `src/features/scene/types/route-projection.ts`
- Create: `src/features/scene/widget/scene/projectRoute.ts`
- Create: `src/features/scene/widget/scene/projectRoute.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/scene/widget/scene/projectRoute.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { asCompanyId, type CompanyEntry } from '../../types/company';
import { projectRoute } from './projectRoute';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

const CAREER_ROUTE_ORDER = [mave, eightfig, riverside, streamelements, tgs];

const placement = (z: number): readonly [number, number, number] => [0, 0, z];

const entryFor = (id: CompanyEntry['id'], z: number): CompanyEntry => ({
  id,
  planet: { assetId: 'mars_b', placement: placement(z) },
  info: {
    companyName: 'X',
    logo: { kind: 'no_icon' },
    website: { kind: 'no_website' },
    role: 'X',
    period: { kind: 'ongoing', start: { year: 2020, month: 1 } },
    description: 'X',
  },
});

const ENTRIES: ReadonlyArray<CompanyEntry> = [
  entryFor(mave, 70),
  entryFor(eightfig, 170),
  entryFor(riverside, 250),
  entryFor(streamelements, 325),
  entryFor(tgs, 395),
];

describe('projectRoute', () => {
  it('returns pre_route with firstTarget=Mave when visited is empty', () => {
    const projection = projectRoute([], ENTRIES, CAREER_ROUTE_ORDER);
    expect(projection).toEqual({
      kind: 'pre_route',
      firstTarget: { id: mave, placement: placement(70) },
    });
  });

  it('returns mid_route with anchor=Mave, nextTarget=8fig when only Mave is visited', () => {
    const projection = projectRoute([mave], ENTRIES, CAREER_ROUTE_ORDER);
    expect(projection).toEqual({
      kind: 'mid_route',
      anchor: { id: mave, placement: placement(70) },
      nextTarget: { id: eightfig, placement: placement(170) },
    });
  });

  it('returns mid_route with anchor=StreamElements, nextTarget=Mave when Earth was visited first (out-of-order)', () => {
    const projection = projectRoute([streamelements], ENTRIES, CAREER_ROUTE_ORDER);
    expect(projection).toEqual({
      kind: 'mid_route',
      anchor: { id: streamelements, placement: placement(325) },
      nextTarget: { id: mave, placement: placement(70) },
    });
  });

  it('returns mid_route with anchor=last-visited regardless of route position (re-visit move-to-end)', () => {
    const projection = projectRoute([mave, eightfig, mave], ENTRIES, CAREER_ROUTE_ORDER);
    expect(projection.kind).toBe('mid_route');
    if (projection.kind !== 'mid_route') throw new Error('expected mid_route');
    expect(projection.anchor.id).toBe(mave);
    expect(projection.nextTarget.id).toBe(riverside);
  });

  it('returns complete with anchor=last-visited when all five are visited (any order)', () => {
    const projection = projectRoute(
      [tgs, streamelements, riverside, eightfig, mave],
      ENTRIES,
      CAREER_ROUTE_ORDER,
    );
    expect(projection).toEqual({
      kind: 'complete',
      anchor: { id: mave, placement: placement(70) },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/scene/widget/scene/projectRoute.test.ts`

Expected: module not found.

- [ ] **Step 3: Create the projection type**

Create `src/features/scene/types/route-projection.ts`:

```ts
import type { CompanyId } from './company';

export type PlacedTarget = {
  readonly id: CompanyId;
  readonly placement: readonly [number, number, number];
};

export type RouteProjection =
  | { readonly kind: 'pre_route'; readonly firstTarget: PlacedTarget }
  | {
      readonly kind: 'mid_route';
      readonly anchor: PlacedTarget;
      readonly nextTarget: PlacedTarget;
    }
  | { readonly kind: 'complete'; readonly anchor: PlacedTarget };
```

- [ ] **Step 4: Create the projection function**

Create `src/features/scene/widget/scene/projectRoute.ts`:

```ts
import type { CompanyEntry, CompanyId } from '../../types/company';
import type { PlacedTarget, RouteProjection } from '../../types/route-projection';

type EntryIndex = ReadonlyMap<CompanyId, CompanyEntry>;

const indexBy = (entries: ReadonlyArray<CompanyEntry>): EntryIndex => {
  const map = new Map<CompanyId, CompanyEntry>();
  for (const entry of entries) map.set(entry.id, entry);
  return map;
};

const placedTargetFor = (entry: CompanyEntry): PlacedTarget => ({
  id: entry.id,
  placement: entry.planet.placement,
});

type RouteLookup =
  | { readonly kind: 'absent' }
  | { readonly kind: 'present'; readonly entry: CompanyEntry };

const lookupEntry = (index: EntryIndex, id: CompanyId): RouteLookup => {
  const entry = index.get(id);
  if (entry === undefined) return { kind: 'absent' };
  return { kind: 'present', entry };
};

type FirstUnvisited =
  | { readonly kind: 'all_visited' }
  | { readonly kind: 'unvisited'; readonly id: CompanyId };

const findFirstUnvisited = (
  order: ReadonlyArray<CompanyId>,
  visitedSet: ReadonlySet<CompanyId>,
): FirstUnvisited => {
  for (const id of order) {
    if (!visitedSet.has(id)) return { kind: 'unvisited', id };
  }
  return { kind: 'all_visited' };
};

type AnchorLookup =
  | { readonly kind: 'no_anchor' }
  | { readonly kind: 'anchor'; readonly target: PlacedTarget };

const resolveAnchor = (
  visited: ReadonlyArray<CompanyId>,
  index: EntryIndex,
): AnchorLookup => {
  if (visited.length === 0) return { kind: 'no_anchor' };
  const lastId = visited[visited.length - 1];
  if (lastId === undefined) return { kind: 'no_anchor' };
  const lookup = lookupEntry(index, lastId);
  if (lookup.kind === 'absent') return { kind: 'no_anchor' };
  return { kind: 'anchor', target: placedTargetFor(lookup.entry) };
};

type FirstTargetLookup =
  | { kind: 'missing' }
  | { kind: 'present'; target: PlacedTarget };

const resolveFirstTarget = (
  order: ReadonlyArray<CompanyId>,
  index: EntryIndex,
): FirstTargetLookup => {
  const firstId = order[0];
  if (firstId === undefined) return { kind: 'missing' };
  const lookup = lookupEntry(index, firstId);
  if (lookup.kind === 'absent') return { kind: 'missing' };
  return { kind: 'present', target: placedTargetFor(lookup.entry) };
};

const PRE_ROUTE_FALLBACK = (target: PlacedTarget): RouteProjection => ({
  kind: 'pre_route',
  firstTarget: target,
});

export const projectRoute = (
  visited: ReadonlyArray<CompanyId>,
  entries: ReadonlyArray<CompanyEntry>,
  order: ReadonlyArray<CompanyId>,
): RouteProjection => {
  const index = indexBy(entries);
  const visitedSet = new Set(visited);
  const anchor = resolveAnchor(visited, index);
  const next = findFirstUnvisited(order, visitedSet);

  if (anchor.kind === 'no_anchor') {
    const firstTarget = resolveFirstTarget(order, index);
    if (firstTarget.kind === 'missing') {
      // Degenerate: empty order or order references an unknown id. The
      // entries / order are project-level constants, so this is a config
      // bug, not runtime input. Fall back to a self-referential empty
      // pre_route — the renderers switch to null on this kind.
      return PRE_ROUTE_FALLBACK({
        id: order[0] ?? entries[0]?.id ?? ('' as CompanyId),
        placement: [0, 0, 0],
      });
    }
    return PRE_ROUTE_FALLBACK(firstTarget.target);
  }

  if (next.kind === 'all_visited') {
    return { kind: 'complete', anchor: anchor.target };
  }

  const nextLookup = lookupEntry(index, next.id);
  if (nextLookup.kind === 'absent') {
    // Same config-bug fallback as above.
    return { kind: 'complete', anchor: anchor.target };
  }

  return {
    kind: 'mid_route',
    anchor: anchor.target,
    nextTarget: placedTargetFor(nextLookup.entry),
  };
};
```

- [ ] **Step 5: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/features/scene/types/route-projection.ts \
        src/features/scene/widget/scene/projectRoute.ts \
        src/features/scene/widget/scene/projectRoute.test.ts
git commit -m "$(cat <<'EOF'
feat(scene): pure RouteProjection + projectRoute

Discriminated union (pre_route / mid_route / complete) derived from
visited + entries + route order. Anchor = last visited; nextTarget =
first unvisited in route order. Frame-independent; distance / on-screen
checks are component-side.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Re-map company entries and export `CAREER_ROUTE_ORDER`

**Files:**
- Modify: `src/features/scene/widget/scene/companies.ts`

This is a data change — no new tests. The existing scene tests (`Scene.test.tsx`) use their own test fixtures, not `getCompanyEntries`, so this won't break them.

- [ ] **Step 1: Rewrite `companies.ts`**

Replace the entire contents of `src/features/scene/widget/scene/companies.ts` with:

```ts
import { asCompanyId, type CompanyEntry, type CompanyId } from '../../types/company';

// Route order from outer → inner along +Z. Saturn (current role) is the
// first stop; Venus (oldest role) is the last. Sun terminus sits past
// Venus as scenery. Mercury / Uranus / Neptune render as filler outside
// the route (see fillerPlanets.ts).
export const CAREER_ROUTE_ORDER: ReadonlyArray<CompanyId> = [
  asCompanyId('mave'),
  asCompanyId('8fig'),
  asCompanyId('riverside'),
  asCompanyId('streamelements'),
  asCompanyId('tgs'),
];

const COMPANY_ENTRIES: ReadonlyArray<CompanyEntry> = [
  {
    id: asCompanyId('mave'),
    planet: { assetId: 'saturn_b', placement: [0, 0, 70] },
    info: {
      companyName: 'Mave',
      logo: { kind: 'with_icon', src: '/icons/mave.svg', backdrop: 'light' },
      website: { kind: 'has_website', url: 'https://www.mave.com/' },
      role: 'Head of Platform',
      period: { kind: 'ongoing', start: { year: 2025, month: 1 } },
      description:
        "Employee #1, responsible for building the company's end-to-end product execution pipeline from ideation to production. Built the platform from scratch while defining the architecture, standards, and practices behind it. Partnered across product, design, R&D, and QA to drive technical decisions and scalable execution.",
    },
  },
  {
    id: asCompanyId('8fig'),
    planet: { assetId: 'jupiter_b', placement: [0, 0, 170] },
    info: {
      companyName: '8fig',
      logo: { kind: 'with_icon', src: '/icons/8fig.svg', backdrop: 'light' },
      website: { kind: 'has_website', url: 'https://www.8fig.co/' },
      role: 'Software Architect',
      period: {
        kind: 'closed',
        start: { year: 2023, month: 7 },
        end: { year: 2025, month: 1 },
      },
      description:
        "Owned critical product systems end to end, building the company's design system and turning ambiguous ideas into production-ready features. Re-architected the back-office platform and rebuilt the main dashboard, reducing load times from 8+ seconds to near-instant. Also set frontend quality standards, mentored engineers, and shaped the engineering interview process.",
    },
  },
  {
    id: asCompanyId('riverside'),
    planet: { assetId: 'mars_b', placement: [0, 0, 250] },
    info: {
      companyName: 'Riverside',
      logo: { kind: 'with_icon', src: '/icons/riverside.svg', backdrop: 'light' },
      website: { kind: 'has_website', url: 'https://riverside.com/' },
      role: 'Group Lead',
      period: {
        kind: 'closed',
        start: { year: 2022, month: 5 },
        end: { year: 2023, month: 4 },
      },
      description:
        'Joined as the sole engineer on the Editor team and rebuilt a neglected product from scratch, creating a stable foundation for scale. Partnered with leadership on the roadmap and long-term vision, and introduced a clear workflow for feature scoping, delivery, and approval across teams. Also built the engineering interview process and served as technical and execution lead as the product scaled from roughly 100 users to nearly 1M.',
    },
  },
  {
    id: asCompanyId('streamelements'),
    planet: { assetId: 'earth_b', placement: [0, 0, 325] },
    info: {
      companyName: 'StreamElements',
      logo: { kind: 'with_icon', src: '/icons/streamelements.svg', backdrop: 'dark' },
      website: { kind: 'has_website', url: 'https://streamelements.com/' },
      role: 'Senior Frontend Engineer',
      period: {
        kind: 'closed',
        start: { year: 2019, month: 10 },
        end: { year: 2022, month: 5 },
      },
      description:
        "Early engineer during the company's formative stage, building multiple products from scratch and leading rapid pivots as market conditions and priorities changed. During COVID-19, remained the sole engineer in the department after a major downsizing and owned critical initiatives during a high-pressure period. That work became foundational to the company's later growth, scale, and $100M SoftBank investment.",
    },
  },
  {
    id: asCompanyId('tgs'),
    planet: { assetId: 'venus_b', placement: [0, 0, 395] },
    info: {
      companyName: 'TGS',
      logo: { kind: 'no_icon' },
      website: { kind: 'no_website' },
      role: 'Frontend Engineer',
      period: {
        kind: 'closed',
        start: { year: 2018, month: 5 },
        end: { year: 2019, month: 10 },
      },
      description:
        'Frontend engineer on a complex, high-traffic travel engine used by major airline customers, including EasyJet and Singapore Airlines. Built a white-label frontend architecture for multiple enterprise clients.',
    },
  },
];

export const getCompanyEntries = (): ReadonlyArray<CompanyEntry> => COMPANY_ENTRIES;
```

Note: `CAREER_ROUTE_ORDER` is exported so `useScene.ts` (Task 14) can pass it into `projectRoute`. The asset ids change — Mave moves from `jupiter_b` to `saturn_b`; 8fig from `saturn_b` to `jupiter_b`; StreamElements from `venus_b` to `earth_b`; TGS from `uranus_b` to `venus_b`. Mars stays on `mars_b`. After this task the dev server renders the new arrangement (and Sun still off-axis — fixed in Task 8).

- [ ] **Step 2: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/features/scene/widget/scene/companies.ts
git commit -m "$(cat <<'EOF'
feat(scene): career planets along +Z, Saturn→Venus career order

Mave→Saturn (z=70), 8fig→Jupiter (170), Riverside→Mars (250),
StreamElements→Earth (325), TGS→Venus (395). Adjacent gaps ≥70 keep
activation zones clear by ≥6 units. CAREER_ROUTE_ORDER exported for the
route projection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Move Sun to `(0, 0, 560)` and bump camera `far` plane to `800`

**Files:**
- Modify: `src/features/scene/components/Scene/Sun.tsx` (line 36)
- Modify: `src/features/scene/components/Scene/FollowCamera.tsx` (line 231)

- [ ] **Step 1: Update the Sun position constant**

In `src/features/scene/components/Scene/Sun.tsx`, find line 36:

```ts
const SUN_POSITION: readonly [number, number, number] = [180, 0, -320];
```

Replace with:

```ts
const SUN_POSITION: readonly [number, number, number] = [0, 0, 560];
```

- [ ] **Step 2: Bump the camera far plane**

In `src/features/scene/components/Scene/FollowCamera.tsx`, find the `<PerspectiveCamera>` JSX (around lines 225-232). Change `far={500}` to `far={800}`:

```tsx
<PerspectiveCamera
  ref={cameraRef}
  makeDefault
  position={cameraInitial}
  fov={BASE_FOV}
  near={0.1}
  far={800}
/>
```

- [ ] **Step 3: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/features/scene/components/Scene/Sun.tsx \
        src/features/scene/components/Scene/FollowCamera.tsx
git commit -m "$(cat <<'EOF'
feat(scene): sun on-axis at z=560, camera far plane 500→800

Sun is the visible terminus past Venus (z=395). Far plane bumped so the
sun + halo render at journey start without clipping, and Neptune (filler
behind start) doesn't pop while the player is near Venus.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Create `PlanetMode` and refactor `Planet` to accept it

**Files:**
- Create: `src/features/scene/types/planet-mode.ts`
- Modify: `src/features/scene/components/Scene/Planet.tsx`
- Modify: `src/features/scene/components/Scene/Companies.tsx`

- [ ] **Step 1: Create the `PlanetMode` type**

Create `src/features/scene/types/planet-mode.ts`:

```ts
import type { RefObject } from 'react';
import type { CompanyId } from './company';
import type {
  PlanetActivations,
  PlanetRadii,
} from '../components/Scene/useSceneRefs';

// Discriminated planet behavior mode. The refs required by 'active' (proximity
// activation, info-panel triggering) live ON the active variant — a 'filler'
// branch cannot reference them by type, so the no-leak rule is enforced
// structurally, not by runtime guard.
export type PlanetMode =
  | {
      readonly kind: 'active';
      readonly id: CompanyId;
      readonly planetRadiiRef: RefObject<PlanetRadii>;
      readonly planetActivationsRef: RefObject<PlanetActivations>;
    }
  | {
      readonly kind: 'filler';
      readonly id: string;
    };
```

- [ ] **Step 2: Refactor `Planet` to take `PlanetMode`**

In `src/features/scene/components/Scene/Planet.tsx`, replace the `PlanetProps` type (lines 26-31) and the relevant logic with this updated file. The key changes:

- Props change from `{ planet: PlanetProjection; planetRadiiRef; planetActivationsRef; sphereCollidersRef }` to `{ assetId; placement; sphereCollidersRef; mode: PlanetMode }`.
- `usePlanetFrame` reads activation state only when `mode.kind === 'active'`; for filler, the activation factor stays at 0.
- The radii write happens only in the active branch.

Replace the file with:

```ts
import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, useGLTF, useTexture } from '@react-three/drei';
import type { Object3D } from 'three';
import type { PlanetAssetId } from '../../types/planet';
import type { PlanetMode } from '../../types/planet-mode';
import {
  buildVisualPlan,
  cloneAndDress,
  extractBody,
  rotationRateFor,
} from '../../services/renderer/planetVisualPlan';
import type { BodyExtraction, PlanetVisualPlan } from '../../services/renderer/planetTypes';
import { planetCollider } from '../../services/renderer/planetCollider';
import { animatePlan } from '../../services/renderer/planetAnimation';
import {
  COLORSHEET_PATH,
  PLANET_PATHS,
  configureColorsheet,
  resolvePlanetLook,
} from '../../services/renderer/planetAssets';
import { planetPoseFor } from '../../services/renderer/planetPose';
import type { PlanetPose } from '../../services/renderer/planetPose';
import type { SphereColliders } from './useSceneRefs';

type PlanetProps = {
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
  readonly sphereCollidersRef: RefObject<SphereColliders>;
  readonly mode: PlanetMode;
};

const PLANET_BASE_SCALE = 1.5;
const PLANET_SWAY_AMPLITUDE = Math.PI / 220;
const PLANET_SWAY_FREQ_HZ = 0.05;
const SCALE_BREATH_AMP = 0.025;
const SCALE_BREATH_FREQ_HZ = 0.05;
const ACTIVATION_LERP_RATE = 4.0;
const ACTIVATION_RADIUS_MULTIPLIER = 4.5;
const TWO_PI = Math.PI * 2;

const idEncoder = new TextEncoder();
const phaseFromId = (id: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(id)) hash = (hash * 31 + byte) % 1000;
  return (hash / 1000) * TWO_PI;
};

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

const usePlanetFrame = (
  mode: PlanetMode,
  plan: PlanetVisualPlan,
  meshRef: RefObject<Object3D | null>,
  phase: number,
  rotationRate: number,
): void => {
  const activationFactorRef = useRef(0);
  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (mesh === null) return;
    mesh.rotation.y += rotationRate * delta;
    const time = state.clock.elapsedTime;
    mesh.rotation.x =
      Math.sin(time * PLANET_SWAY_FREQ_HZ * TWO_PI + phase * 1.3) * PLANET_SWAY_AMPLITUDE;
    const target =
      mode.kind === 'active' && mode.planetActivationsRef.current.isActive(mode.id) ? 1 : 0;
    const current = activationFactorRef.current;
    const blend = 1 - Math.exp(-ACTIVATION_LERP_RATE * delta);
    const factor = current + (target - current) * blend;
    activationFactorRef.current = factor;
    const scaleBreath = Math.sin(time * SCALE_BREATH_FREQ_HZ * TWO_PI + phase * 0.7);
    const s = PLANET_BASE_SCALE * (1 + scaleBreath * SCALE_BREATH_AMP * factor);
    mesh.scale.set(s, s, s);
    animatePlan(plan, time, phase, factor);
  });
};

export const Planet = (props: PlanetProps): JSX.Element => {
  const { scene } = useGLTF(PLANET_PATHS[props.assetId]);
  const colorsheet = useTexture(COLORSHEET_PATH);
  const look = useMemo(() => resolvePlanetLook(props.assetId), [props.assetId]);
  const phase = useMemo(() => phaseFromId(props.mode.id), [props.mode.id]);
  const plan = useMemo<PlanetVisualPlan>(() => {
    configureColorsheet(colorsheet);
    return buildVisualPlan(look, cloneAndDress(scene, colorsheet, look), phase);
  }, [scene, colorsheet, look, phase]);
  const derived = useMemo(() => deriveBodyValues(scene), [scene]);
  if (props.mode.kind === 'active') {
    props.mode.planetRadiiRef.current.write(props.mode.id, derived.activeRadius);
  }
  props.sphereCollidersRef.current.register(
    props.mode.id,
    planetCollider(derived.extraction, props.placement, PLANET_BASE_SCALE),
  );
  const meshRef = useRef<Object3D | null>(null);
  const rotationRate = useMemo(() => rotationRateFor(phase), [phase]);

  usePlanetFrame(props.mode, plan, meshRef, phase, rotationRate);

  return (
    <group position={props.placement}>
      <group ref={meshRef}>
        <group quaternion={derived.pose.alignQuaternion}>
          <Center>
            <primitive object={plan.scene} />
          </Center>
        </group>
      </group>
    </group>
  );
};

useTexture.preload(COLORSHEET_PATH);
for (const path of Object.values(PLANET_PATHS)) useGLTF.preload(path);
```

- [ ] **Step 3: Update `Companies.tsx` to construct the active mode**

Replace `src/features/scene/components/Scene/Companies.tsx`:

```ts
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
        assetId={planet.planet.assetId}
        placement={planet.planet.placement}
        sphereCollidersRef={props.sphereCollidersRef}
        mode={{
          kind: 'active',
          id: planet.id,
          planetRadiiRef: props.planetRadiiRef,
          planetActivationsRef: props.planetActivationsRef,
        }}
      />
    ))}
  </group>
);
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`

Expected: green. (Planet.test.tsx tests only pure utilities — they continue to pass without changes.)

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/types/planet-mode.ts \
        src/features/scene/components/Scene/Planet.tsx \
        src/features/scene/components/Scene/Companies.tsx
git commit -m "$(cat <<'EOF'
refactor(scene): Planet takes PlanetMode discriminated prop

PlanetMode = 'active' (carries id + radii/activations refs) | 'filler'
(id only). Splits the previously-coupled Planet responsibilities along the
type system — a filler branch cannot reach radii / activations refs, no
flag or runtime guard. Companies constructs the active mode at call site.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Create `FILLER_PLANETS` data + `<FillerPlanets>` component + mount in Scene

**Files:**
- Create: `src/features/scene/widget/scene/fillerPlanets.ts`
- Create: `src/features/scene/components/Scene/FillerPlanets.tsx`
- Modify: `src/features/scene/components/Scene/Scene.tsx`

- [ ] **Step 1: Create the filler data**

Create `src/features/scene/widget/scene/fillerPlanets.ts`:

```ts
import type { PlanetAssetId } from '../../types/planet';

// Filler planets render off-axis (so they read as "in their own orbits"
// without blocking the +Z tour route) and carry NO company info. The id is
// a sphere-collider registry key only — not a CompanyId — so it cannot
// reach the proximity / info-panel pipeline by construction.
export type FillerPlanetEntry = {
  readonly id: string;
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
};

export const FILLER_PLANETS: ReadonlyArray<FillerPlanetEntry> = [
  { id: 'filler:uranus', assetId: 'uranus_b', placement: [40, 0, -110] },
  { id: 'filler:neptune', assetId: 'neptune_b', placement: [-55, 0, -200] },
  { id: 'filler:mercury', assetId: 'mercury_b', placement: [0, 0, 445] },
];
```

- [ ] **Step 2: Create the renderer**

Create `src/features/scene/components/Scene/FillerPlanets.tsx`:

```ts
import type { JSX, RefObject } from 'react';
import { FILLER_PLANETS } from '../../widget/scene/fillerPlanets';
import { Planet } from './Planet';
import type { SphereColliders } from './useSceneRefs';

type FillerPlanetsProps = {
  readonly sphereCollidersRef: RefObject<SphereColliders>;
};

export const FillerPlanets = (props: FillerPlanetsProps): JSX.Element => (
  <group>
    {FILLER_PLANETS.map((entry) => (
      <Planet
        key={entry.id}
        assetId={entry.assetId}
        placement={entry.placement}
        sphereCollidersRef={props.sphereCollidersRef}
        mode={{ kind: 'filler', id: entry.id }}
      />
    ))}
  </group>
);
```

- [ ] **Step 3: Mount `<FillerPlanets>` in `<Scene>`**

In `src/features/scene/components/Scene/Scene.tsx`, add the import:

```ts
import { FillerPlanets } from './FillerPlanets';
```

Then in the JSX returned by `Scene`, mount it right after `<Companies>`:

```tsx
<Companies
  planets={planets}
  planetRadiiRef={planetRadiiRef}
  planetActivationsRef={planetActivationsRef}
  sphereCollidersRef={sphereCollidersRef}
/>
<FillerPlanets sphereCollidersRef={sphereCollidersRef} />
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/widget/scene/fillerPlanets.ts \
        src/features/scene/components/Scene/FillerPlanets.tsx \
        src/features/scene/components/Scene/Scene.tsx
git commit -m "$(cat <<'EOF'
feat(scene): filler planets (Mercury, Uranus, Neptune)

Three filler planets render off-axis through <Planet mode={{ kind: 'filler' }}>.
Sphere colliders register so the ship can't enter their bodies; no proximity
hooks, no radii write, no activation animation. ProximityWatcher's entries
remain career-only, so fillers cannot reach the FSM.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Create `<WaypointBeam>` + pure-helper test

**Files:**
- Create: `src/features/scene/components/Scene/WaypointBeam.tsx`
- Create: `src/features/scene/components/Scene/WaypointBeam.test.ts`

The pure switch (`cuesFor`) is extracted as a top-level export so it can be tested without any React / R3F setup. The React component is a thin shell around the pure helper; it's verified in-browser per the spec's acceptance criteria.

- [ ] **Step 1: Write the failing tests**

Create `src/features/scene/components/Scene/WaypointBeam.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../types/company';
import type { RouteProjection } from '../../types/route-projection';
import { cuesFor } from './WaypointBeam';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');

const PRE_ROUTE: RouteProjection = {
  kind: 'pre_route',
  firstTarget: { id: mave, placement: [0, 0, 70] },
};
const MID_ROUTE: RouteProjection = {
  kind: 'mid_route',
  anchor: { id: mave, placement: [0, 0, 70] },
  nextTarget: { id: eightfig, placement: [0, 0, 170] },
};
const COMPLETE: RouteProjection = {
  kind: 'complete',
  anchor: { id: mave, placement: [0, 0, 70] },
};

describe('WaypointBeam.cuesFor — switch on projection.kind', () => {
  it('returns silent for pre_route (no anchor yet, nothing to draw between)', () => {
    expect(cuesFor(PRE_ROUTE)).toEqual({ kind: 'silent' });
  });

  it('returns silent for complete (tour over, no nextTarget)', () => {
    expect(cuesFor(COMPLETE)).toEqual({ kind: 'silent' });
  });

  it('returns visible with anchor and nextTarget placements as start and end for mid_route', () => {
    expect(cuesFor(MID_ROUTE)).toEqual({
      kind: 'visible',
      start: [0, 0, 70],
      end: [0, 0, 170],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/scene/components/Scene/WaypointBeam.test.ts`

Expected: module not found.

- [ ] **Step 3: Implement `<WaypointBeam>` (with exported `cuesFor`)**

Create `src/features/scene/components/Scene/WaypointBeam.tsx`:

```ts
import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
} from 'three';
import type { RouteProjection } from '../../types/route-projection';

type WaypointBeamProps = {
  readonly projection: RouteProjection;
};

const BEAM_COLOR = '#5fd6ff';
const BEAM_BASE_OPACITY = 0.25;
const BEAM_PULSE_AMPLITUDE = 0.12;
const BEAM_PULSE_HZ = 0.12;
const TWO_PI = Math.PI * 2;

export type BeamCues =
  | { readonly kind: 'silent' }
  | {
      readonly kind: 'visible';
      readonly start: readonly [number, number, number];
      readonly end: readonly [number, number, number];
    };

export const cuesFor = (projection: RouteProjection): BeamCues => {
  switch (projection.kind) {
    case 'pre_route':
    case 'complete':
      return { kind: 'silent' };
    case 'mid_route':
      return {
        kind: 'visible',
        start: projection.anchor.placement,
        end: projection.nextTarget.placement,
      };
  }
};

type LineHandle = { readonly line: LineSegments; readonly material: LineBasicMaterial };

const makeLine = (
  start: readonly [number, number, number],
  end: readonly [number, number, number],
): LineHandle => {
  const geometry = new BufferGeometry();
  const positions = new Float32Array([start[0], start[1], start[2], end[0], end[1], end[2]]);
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color: new Color(BEAM_COLOR),
    transparent: true,
    opacity: BEAM_BASE_OPACITY,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const line = new LineSegments(geometry, material);
  line.renderOrder = 2;
  return { line, material };
};

const useBeamPulse = (handle: LineHandle | null): void => {
  useFrame((state) => {
    if (handle === null) return;
    const pulse = Math.sin(state.clock.elapsedTime * BEAM_PULSE_HZ * TWO_PI);
    handle.material.opacity = BEAM_BASE_OPACITY + pulse * BEAM_PULSE_AMPLITUDE;
  });
};

export const WaypointBeam = (props: WaypointBeamProps): JSX.Element | null => {
  const cues = useMemo(() => cuesFor(props.projection), [props.projection]);
  const handleRef = useRef<LineHandle | null>(null);

  const handle = useMemo<LineHandle | null>(() => {
    if (cues.kind === 'silent') return null;
    return makeLine(cues.start, cues.end);
  }, [cues]);

  handleRef.current = handle;
  useBeamPulse(handle);

  if (handle === null) return null;
  return <primitive object={handle.line} />;
};
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/components/Scene/WaypointBeam.tsx \
        src/features/scene/components/Scene/WaypointBeam.test.ts
git commit -m "$(cat <<'EOF'
feat(scene): WaypointBeam — 3D additive line cue between planets

Pure prop-in renderer. Switches on RouteProjection.kind via exported
cuesFor: silent for pre_route/complete; additive cyan line geometry with
slow opacity pulse for mid_route. Anchor → nextTarget endpoints; no per-
frame geometry rebuild (only the material opacity tweaks). Pure switch
extracted as cuesFor for unit testing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Create `<WaypointMarker>` + pure-helper tests

**Files:**
- Create: `src/features/scene/components/Scene/WaypointMarker.tsx`
- Create: `src/features/scene/components/Scene/WaypointMarker.ndc.ts`
- Create: `src/features/scene/components/Scene/WaypointMarker.test.ts`

Two pure helpers (`targetFor` switch on projection.kind, `clampToEdge` for screen-edge math, `isInsideNdc` predicate) are extracted and tested without React / R3F. The per-frame camera-dependent projection lives inside the component, verified in-browser.

- [ ] **Step 1: Write the failing tests**

Create `src/features/scene/components/Scene/WaypointMarker.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../types/company';
import type { RouteProjection } from '../../types/route-projection';
import { targetFor } from './WaypointMarker';
import { clampToEdge, isInsideNdc } from './WaypointMarker.ndc';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');

const PRE_ROUTE: RouteProjection = {
  kind: 'pre_route',
  firstTarget: { id: mave, placement: [0, 0, 70] },
};
const MID_ROUTE: RouteProjection = {
  kind: 'mid_route',
  anchor: { id: mave, placement: [0, 0, 70] },
  nextTarget: { id: eightfig, placement: [0, 0, 170] },
};
const COMPLETE: RouteProjection = {
  kind: 'complete',
  anchor: { id: mave, placement: [0, 0, 70] },
};

describe('WaypointMarker.targetFor — switch on projection.kind', () => {
  it('returns none for complete', () => {
    expect(targetFor(COMPLETE)).toEqual({ kind: 'none' });
  });

  it("returns target=firstTarget for pre_route", () => {
    expect(targetFor(PRE_ROUTE)).toEqual({
      kind: 'target',
      target: { id: mave, placement: [0, 0, 70] },
    });
  });

  it('returns target=nextTarget for mid_route', () => {
    expect(targetFor(MID_ROUTE)).toEqual({
      kind: 'target',
      target: { id: eightfig, placement: [0, 0, 170] },
    });
  });
});

describe('WaypointMarker.ndc — isInsideNdc + clampToEdge', () => {
  it('isInsideNdc returns true when both coords are within [-1, 1]', () => {
    expect(isInsideNdc([0, 0])).toBe(true);
    expect(isInsideNdc([-1, 1])).toBe(true);
    expect(isInsideNdc([0.5, -0.5])).toBe(true);
  });

  it('isInsideNdc returns false when either coord is outside [-1, 1]', () => {
    expect(isInsideNdc([1.5, 0])).toBe(false);
    expect(isInsideNdc([0, -1.2])).toBe(false);
    expect(isInsideNdc([2, 2])).toBe(false);
  });

  it('clampToEdge scales an off-screen NDC point onto the EDGE_PADDING shell while preserving direction', () => {
    const result = clampToEdge(2, 0);
    expect(result.edgeX).toBeCloseTo(0.92, 5);
    expect(result.edgeY).toBeCloseTo(0, 5);
  });

  it('clampToEdge preserves the angle for diagonal off-screen targets', () => {
    const result = clampToEdge(3, 3);
    // Both coords were equal at input, magnitude=3, scale=0.92/3, so both
    // end up at 0.92.
    expect(result.edgeX).toBeCloseTo(0.92, 5);
    expect(result.edgeY).toBeCloseTo(0.92, 5);
  });

  it('clampToEdge returns origin for a zero-magnitude input (degenerate)', () => {
    expect(clampToEdge(0, 0)).toEqual({ edgeX: 0, edgeY: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/scene/components/Scene/WaypointMarker.test.ts`

Expected: module not found.

- [ ] **Step 3: Create the NDC projection + clamp helpers**

Create `src/features/scene/components/Scene/WaypointMarker.ndc.ts`:

```ts
import { Vector3, type PerspectiveCamera } from 'three';

const scratch = new Vector3();

// Projects a world point into normalized device coordinates [-1, 1]^2 using
// the supplied camera's matrices. Returns (ndcX, ndcY). Z is discarded.
export const projectToNdc = (
  point: readonly [number, number, number],
  camera: PerspectiveCamera,
): readonly [number, number] => {
  scratch.set(point[0], point[1], point[2]);
  scratch.project(camera);
  return [scratch.x, scratch.y];
};

export const isInsideNdc = (ndc: readonly [number, number]): boolean =>
  ndc[0] >= -1 && ndc[0] <= 1 && ndc[1] >= -1 && ndc[1] <= 1;

const EDGE_PADDING = 0.92;

export const clampToEdge = (
  ndcX: number,
  ndcY: number,
): { readonly edgeX: number; readonly edgeY: number } => {
  const magnitude = Math.max(Math.abs(ndcX), Math.abs(ndcY));
  if (magnitude === 0) return { edgeX: 0, edgeY: 0 };
  const scale = EDGE_PADDING / magnitude;
  return { edgeX: ndcX * scale, edgeY: ndcY * scale };
};
```

- [ ] **Step 4: Implement `<WaypointMarker>`**

Create `src/features/scene/components/Scene/WaypointMarker.tsx`:

```ts
import type { CSSProperties, JSX, RefObject } from 'react';
import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { PerspectiveCamera } from 'three';
import type { Kinematics } from '../../types/kinematics';
import type { PlacedTarget, RouteProjection } from '../../types/route-projection';
import { clampToEdge, isInsideNdc, projectToNdc } from './WaypointMarker.ndc';

type WaypointMarkerProps = {
  readonly projection: RouteProjection;
  readonly kinematicsRef: RefObject<Kinematics>;
};

export type ActiveTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'target'; readonly target: PlacedTarget };

export const targetFor = (projection: RouteProjection): ActiveTarget => {
  switch (projection.kind) {
    case 'complete':
      return { kind: 'none' };
    case 'pre_route':
      return { kind: 'target', target: projection.firstTarget };
    case 'mid_route':
      return { kind: 'target', target: projection.nextTarget };
  }
};

type MarkerView =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'visible';
      readonly edgeX: number;
      readonly edgeY: number;
      readonly distance: number;
    };

const distanceBetween = (
  a: { readonly x: number; readonly y: number; readonly z: number },
  b: readonly [number, number, number],
): number => Math.hypot(a.x - b[0], a.y - b[1], a.z - b[2]);

const PILL_STYLE: CSSProperties = {
  pointerEvents: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '4px 10px',
  borderRadius: '999px',
  backgroundColor: 'rgba(10, 13, 24, 0.78)',
  border: '1px solid rgba(95, 214, 255, 0.45)',
  color: '#aeefff',
  font: '600 10px / 1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const CHEVRON_STYLE: CSSProperties = {
  display: 'inline-block',
  width: '12px',
  height: '12px',
  borderTop: '2px solid #5fd6ff',
  borderRight: '2px solid #5fd6ff',
};

const computeChevronRotation = (edgeX: number, edgeY: number): number => {
  const radians = Math.atan2(edgeY, edgeX);
  return -(radians * 180) / Math.PI - 45;
};

export const WaypointMarker = (props: WaypointMarkerProps): JSX.Element | null => {
  const camera = useThree((three) => three.camera as PerspectiveCamera);
  const active = useMemo(() => targetFor(props.projection), [props.projection]);
  const [view, setView] = useState<MarkerView>({ kind: 'hidden' });
  const lastNdcRef = useRef<{ readonly x: number; readonly y: number; readonly distance: number } | null>(null);

  useFrame(() => {
    if (active.kind === 'none') {
      if (view.kind !== 'hidden') setView({ kind: 'hidden' });
      lastNdcRef.current = null;
      return;
    }
    const target = active.target;
    const ndc = projectToNdc(target.placement, camera);
    const inside = isInsideNdc(ndc);
    if (inside) {
      if (view.kind !== 'hidden') setView({ kind: 'hidden' });
      lastNdcRef.current = null;
      return;
    }
    const playerPos = props.kinematicsRef.current.position;
    const distance = distanceBetween(playerPos, target.placement);
    const last = lastNdcRef.current;
    if (
      last !== null &&
      Math.abs(last.x - ndc[0]) < 0.005 &&
      Math.abs(last.y - ndc[1]) < 0.005 &&
      Math.abs(last.distance - distance) < 0.5
    ) {
      return;
    }
    const { edgeX, edgeY } = clampToEdge(ndc[0], ndc[1]);
    lastNdcRef.current = { x: ndc[0], y: ndc[1], distance };
    setView({ kind: 'visible', edgeX, edgeY, distance });
  });

  if (view.kind === 'hidden') return null;

  return (
    <Html fullscreen transform={false} prepend>
      <div
        style={{
          position: 'absolute',
          left: `${((view.edgeX + 1) / 2) * 100}%`,
          top: `${((1 - view.edgeY) / 2) * 100}%`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      >
        <div style={PILL_STYLE}>
          <span
            style={{
              ...CHEVRON_STYLE,
              transform: `rotate(${computeChevronRotation(view.edgeX, view.edgeY)}deg)`,
            }}
          />
          <span>{Math.round(view.distance)} m</span>
        </div>
      </div>
    </Html>
  );
};
```

- [ ] **Step 5: Run the full check**

Run: `pnpm check`

Expected: green. The pure helpers (`targetFor`, `clampToEdge`, `isInsideNdc`) are unit-tested; the camera-dependent per-frame projection inside the React component is verified in-browser.

- [ ] **Step 6: Commit**

```bash
git add src/features/scene/components/Scene/WaypointMarker.tsx \
        src/features/scene/components/Scene/WaypointMarker.test.ts \
        src/features/scene/components/Scene/WaypointMarker.ndc.ts
git commit -m "$(cat <<'EOF'
feat(scene): WaypointMarker — screen-edge HUD arrow + distance pill

Pure prop-in renderer. Hidden when target on-screen or projection.kind is
'complete'; renders a clamped-edge chevron + monospace distance pill
otherwise. Cyan accent on dark, matches existing dock / panel tokens.
Same React tree as the canvas via drei <Html>; no portal. Pure switch
(targetFor) and edge-clamp math (clampToEdge / isInsideNdc) extracted to
testable helpers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Player boost wiring (intent gate, two trails, multiplier)

**Files:**
- Modify: `src/features/scene/components/Scene/Player.tsx`
- Modify: `src/features/scene/components/Scene/Scene.tsx` (pass boostSignalRef to Player)

- [ ] **Step 1: Extend `Player`'s props and wire the gate**

In `src/features/scene/components/Scene/Player.tsx`:

Replace the imports block at the top with:

```ts
import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Center, Trail, useGLTF } from '@react-three/drei';
import type { Group, Object3D, Vector3 as Vector3Impl } from 'three';
import { Vector3 } from 'three';
import { clampOutOfSphere } from '../../services/renderer/clampOutOfSphere';
import { integrateMotion } from '../../services/renderer/integrateMotion';
import type { CameraBasis } from '../../services/renderer/integrateMotion';
import { cloneAndDressShip } from '../../services/renderer/shipVisualPlan';
import { MAX_SPEED, type Kinematics } from '../../types/kinematics';
import type { IntentStream } from '../../types/intent';
import type { SceneState } from '../../types/scene-state';
import type { ShipEntry } from '../../../ships/types/ship';
import type { BoostSignal, PlanetActivations, SphereColliders } from './useSceneRefs';
```

Extend `PlayerProps`:

```ts
type PlayerProps = {
  readonly ship: ShipEntry;
  readonly sceneState: SceneState;
  readonly intents: IntentStream;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly meshRef: RefObject<Object3D | null>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly boostSignalRef: RefObject<BoostSignal>;
};
```

Add constants for the boost factor smoothing and the magenta trail. Replace the existing trail constants block with:

```ts
const BOOST_FACTOR_LERP_RATE = 6;

const TAIL_OFFSET_Z = 0.75;
const TRAIL_BASE_COLOR = '#5fd6ff';
const TRAIL_BASE_WIDTH = 6.0;
const TRAIL_BASE_LENGTH = 4;
const TRAIL_BOOST_COLOR = '#aeefff';
const TRAIL_BOOST_WIDTH = 8.0;
const TRAIL_BOOST_LENGTH = 8;
const TRAIL_DECAY = 1;
const TRAIL_ATTENUATION = (t: number): number => t * t;
```

Replace the `usePlayerFrame` body to compute and write the boost signal, gate the multiplier, and update the trail opacities. The signature gets a refs object so the gate has what it needs without ballooning the param count. Replace the existing `usePlayerFrame` with:

```ts
type BoostState = { active: boolean; factor: number };

const computeBoostState = (
  prev: number,
  boostHeld: boolean,
  inAnyActivation: boolean,
  delta: number,
): BoostState => {
  const active = boostHeld && !inAnyActivation;
  const target = active ? 1 : 0;
  const blend = 1 - Math.exp(-BOOST_FACTOR_LERP_RATE * delta);
  const factor = prev + (target - prev) * blend;
  return { active, factor };
};

const usePlayerFrame = (
  props: PlayerProps,
  visualRef: RefObject<Group | null>,
  baseTrailRef: RefObject<{ opacity: number } | null>,
  boostTrailRef: RefObject<{ opacity: number } | null>,
): void => {
  const camera = useThree((three) => three.camera);
  const cameraWorldDir = useMemo(() => new Vector3(), []);
  const forwardScratch = useMemo(() => new Vector3(), []);
  const rightScratch = useMemo(() => new Vector3(), []);
  const upScratch = useMemo(() => new Vector3(0, 1, 0), []);
  const baselinePitch = useRef(0);
  const baselineRoll = useRef(0);
  const boostFactorRef = useRef(0);

  useFrame((state, delta) => {
    if (!integratesIn(props.sceneState)) return;
    const mesh = props.meshRef.current;
    if (mesh === null) return;

    const boostHeld = props.intents.current.has('boost');
    const inAnyActivation = props.planetActivationsRef.current.anyActive();
    const boost = computeBoostState(boostFactorRef.current, boostHeld, inAnyActivation, delta);
    boostFactorRef.current = boost.factor;
    props.boostSignalRef.current.write(boost.active, boost.factor);
    const multiplier: 1 | 3 = boost.active ? 3 : 1;

    camera.getWorldDirection(cameraWorldDir);
    const basis = deriveBasis(cameraWorldDir, forwardScratch, rightScratch, upScratch);
    const integrated = integrateMotion(
      props.kinematicsRef.current,
      props.intents.current,
      delta,
      basis,
      multiplier,
    );
    const clampedPosition = props.sphereCollidersRef.current
      .list()
      .reduce((pos, sphere) => clampOutOfSphere(pos, sphere), integrated.position);
    const next: Kinematics =
      clampedPosition === integrated.position
        ? integrated
        : { ...integrated, position: clampedPosition };
    props.kinematicsRef.current = next;

    const speed = Math.hypot(next.velocity.x, next.velocity.z);
    const baseTopSpeed = MAX_SPEED * 3;
    const speedRatio = speed === 0 ? 0 : Math.min(1, speed / baseTopSpeed);
    const idle = computeIdleMotion(speedRatio, state.clock.elapsedTime);
    mesh.position.set(next.position.x, next.position.y, next.position.z);
    const visual = visualRef.current;
    if (visual !== null) visual.position.y = idle.bobY;

    applyHeadingLerp(mesh, next.velocity, speed);

    const target = computeRotationTargets(next.velocity, basis);
    baselinePitch.current += (target.pitch - baselinePitch.current) * ORIENT_LERP;
    baselineRoll.current += (target.roll - baselineRoll.current) * ORIENT_LERP;
    mesh.rotation.x = baselinePitch.current;
    mesh.rotation.z = baselineRoll.current + idle.swayZ;

    const baseTrail = baseTrailRef.current;
    if (baseTrail !== null) baseTrail.opacity = 1 - boost.factor;
    const boostTrail = boostTrailRef.current;
    if (boostTrail !== null) boostTrail.opacity = boost.factor;
  });
};
```

Note: the existing `computeRotationTargets` already divides by `MAX_SPEED` to compute pitch/roll clamps — that's a baseline-relative tilt and stays unchanged (boost should not tilt the ship harder than the baseline maximum). Only the `speedRatio` used for idle-motion and orientation visuals widens to `MAX_SPEED * 3` so the idle micro-motion correctly dampens at boost speeds.

Update the `<Player>` JSX to add the second Trail. Replace the existing `return` block of `Player`:

```tsx
export const Player = (props: PlayerProps): JSX.Element => {
  const { scene } = useGLTF(props.ship.glbPath);
  const dressed = useMemo(() => cloneAndDressShip(scene), [scene]);
  const shipScale = useMemo<readonly [number, number, number]>(
    () => [props.ship.scale, props.ship.scale, props.ship.scale],
    [props.ship.scale],
  );
  const visualRef = useRef<Group | null>(null);
  const baseTrailMatRef = useRef<{ opacity: number } | null>(null);
  const boostTrailMatRef = useRef<{ opacity: number } | null>(null);
  usePlayerFrame(props, visualRef, baseTrailMatRef, boostTrailMatRef);
  return (
    <group ref={props.meshRef} scale={shipScale} rotation={[0, 0, 0, 'YXZ']}>
      <ShipRig />
      <group ref={visualRef}>
        <group rotation={[0, Math.PI, 0]}>
          <Center>
            <primitive object={dressed.scene} />
          </Center>
        </group>
      </group>
      <group rotation={[0, Math.PI, 0]}>
        <Trail
          width={TRAIL_BASE_WIDTH}
          length={TRAIL_BASE_LENGTH}
          color={TRAIL_BASE_COLOR}
          decay={TRAIL_DECAY}
          attenuation={TRAIL_ATTENUATION}
          ref={writeTrailMaterial(baseTrailMatRef, 1)}
        >
          <group position={[0, 0, TAIL_OFFSET_Z]} />
        </Trail>
        <Trail
          width={TRAIL_BOOST_WIDTH}
          length={TRAIL_BOOST_LENGTH}
          color={TRAIL_BOOST_COLOR}
          decay={TRAIL_DECAY}
          attenuation={TRAIL_ATTENUATION}
          ref={writeTrailMaterial(boostTrailMatRef, 0)}
        >
          <group position={[0, 0, TAIL_OFFSET_Z]} />
        </Trail>
      </group>
    </group>
  );
};
```

Above the `Player` export, add the trail-material capture helper (a thin adapter around drei's ref shape, mirroring `tweakTrailMaterial` from `Asteroids.tsx`):

```ts
import type { Mesh } from 'three';

const writeTrailMaterial =
  (target: { current: { opacity: number } | null }, initialOpacity: number) =>
  (mesh: Mesh | null): void => {
    if (mesh === null) {
      target.current = null;
      return;
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      target.current = null;
      return;
    }
    mat.transparent = true;
    mat.opacity = initialOpacity;
    mat.depthWrite = false;
    target.current = mat;
  };
```

(`Mesh` is already imported in `Asteroids.tsx`; this is a new import for Player.tsx. The full import line at the top becomes `import type { Group, Mesh, Object3D, Vector3 as Vector3Impl } from 'three';` — extending the existing line.)

- [ ] **Step 2: Wire `boostSignalRef` + `planetActivationsRef` through `<Scene>`**

In `src/features/scene/components/Scene/Scene.tsx`, change the destructure at the top of `Scene`:

```ts
const {
  meshRef,
  planetRadiiRef,
  planetActivationsRef,
  sphereCollidersRef,
  boostSignalRef,
} = useSceneRefs();
```

Update the `<Player>` element:

```tsx
<Player
  ship={props.ship}
  sceneState={props.state}
  intents={props.intents}
  kinematicsRef={props.kinematicsRef}
  meshRef={meshRef}
  sphereCollidersRef={sphereCollidersRef}
  planetActivationsRef={planetActivationsRef}
  boostSignalRef={boostSignalRef}
/>
```

- [ ] **Step 3: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/features/scene/components/Scene/Player.tsx \
        src/features/scene/components/Scene/Scene.tsx
git commit -m "$(cat <<'EOF'
feat(scene): Player boost — gated 3× multiplier + two-trail cross-fade

Boost is held = Space intent AND no current planet activation. Smoothed
factor (lerp ~6 /sec) drives the magenta-cyan trail cross-fade. Multiplier
1|3 fed into integrateMotion. BoostSignal published every frame for
FollowCamera to consume (next task).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: FollowCamera reads BoostSignal — FOV + look-ahead lifts

**Files:**
- Modify: `src/features/scene/components/Scene/FollowCamera.tsx`
- Modify: `src/features/scene/components/Scene/Scene.tsx`

- [ ] **Step 1: Accept `boostSignalRef` in FollowCamera and apply lifts**

In `src/features/scene/components/Scene/FollowCamera.tsx`, change the import line:

```ts
import { MAX_SPEED, type Kinematics, type Vec3 } from '../../types/kinematics';
import type { BoostSignal } from './useSceneRefs';
```

Extend `FollowCameraProps`:

```ts
type FollowCameraProps = {
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly boostSignalRef: RefObject<BoostSignal>;
};
```

Add a new constants block near the other camera tunables:

```ts
const BOOST_FOV_LIFT = 8;          // FOV target += factor × 8 → 64 → 72 at boost peak
const BOOST_LOOK_AHEAD_LIFT = 1.8; // look-ahead amplitude += factor × 1.8 → 1.8 → 3.6 at boost peak
```

In `updateChaseCamera`, after the existing `speedRatio` computation but before the FOV target line, read the boost factor and apply the additive lifts. Find the section around:

```ts
const targetFov = BASE_FOV + (MAX_FOV - BASE_FOV) * speedRatio;
```

Replace it (and the look-ahead section that follows) with:

```ts
const boostFactor = memory.boostFactor;
const targetFov = BASE_FOV + (MAX_FOV - BASE_FOV) * speedRatio + boostFactor * BOOST_FOV_LIFT;
const liftedLookAhead = MAX_LOOK_AHEAD + boostFactor * BOOST_LOOK_AHEAD_LIFT;
```

Then in the look-ahead target lines that follow, replace `MAX_LOOK_AHEAD` with `liftedLookAhead`:

```ts
const targetAheadX = velocity.x * directionScale * speedRatio * liftedLookAhead;
const forwardVz = Math.max(0, velocity.z);
const targetAheadZ = forwardVz * directionScale * speedRatio * liftedLookAhead;
```

Add `boostFactor: number` to `ChaseMemory` (existing type around line 13):

```ts
type ChaseMemory = {
  // ... existing fields ...
  boostFactor: number;
};
```

And to `createMemory`:

```ts
const createMemory = (): ChaseMemory => ({
  // ... existing fields ...
  boostFactor: 0,
});
```

In the `FollowCamera` component itself, read the boost signal each frame just before calling `updateChaseCamera`:

```ts
export const FollowCamera = (props: FollowCameraProps): JSX.Element => {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const memoryRef = useRef<ChaseMemory>(createMemory());

  useFrame((_root, delta) => {
    const camera = cameraRef.current;
    if (camera === null) return;
    memoryRef.current.boostFactor = props.boostSignalRef.current.read().factor;
    updateChaseCamera(camera, props.kinematicsRef.current, memoryRef.current, delta);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={cameraInitial}
      fov={BASE_FOV}
      near={0.1}
      far={800}
    />
  );
};
```

- [ ] **Step 2: Pass `boostSignalRef` from `<Scene>` to `<FollowCamera>`**

In `src/features/scene/components/Scene/Scene.tsx`, update the `<FollowCamera>` element:

```tsx
<FollowCamera kinematicsRef={props.kinematicsRef} boostSignalRef={boostSignalRef} />
```

- [ ] **Step 3: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/features/scene/components/Scene/FollowCamera.tsx \
        src/features/scene/components/Scene/Scene.tsx
git commit -m "$(cat <<'EOF'
feat(scene): FollowCamera reads BoostSignal — FOV + look-ahead lifts

Additive lifts on top of the existing speed-driven FOV ramp and look-ahead
amplitude. Existing lerp rates apply. FOV peaks at 72 (base 64 + 8), look-
ahead at 3.6 (base 1.8 + 1.8). Returns to base as boost factor decays.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Expose `routeProjection` + mount Waypoint components

**Files:**
- Modify: `src/features/scene/widget/scene/useScene.ts`
- Modify: `src/features/scene/widget/scene/SceneWidget.tsx`
- Modify: `src/features/scene/components/Scene/Scene.tsx`

- [ ] **Step 1: Project the route in `useScene`**

In `src/features/scene/widget/scene/useScene.ts`, add the imports:

```ts
import { CAREER_ROUTE_ORDER, getCompanyEntries } from './companies';
import { projectRoute } from './projectRoute';
import type { RouteProjection } from '../../types/route-projection';
```

The existing `getCompanyEntries` import line should now be merged with `CAREER_ROUTE_ORDER`:

```ts
import { CAREER_ROUTE_ORDER, getCompanyEntries } from './companies';
```

Extend the helper that snapshots the FSM. The existing `getSceneState` only returns `scene`. Add a second selector or read the snapshot directly. Inside `useScene`, after the existing `const state = getSceneState(snapshot);` line, derive the visited array from the snapshot and project:

```ts
const visited = snapshot.context.visited;
const routeProjection = useMemo<RouteProjection>(
  () => projectRoute(visited, entries, CAREER_ROUTE_ORDER),
  [visited, entries],
);
```

Add `routeProjection` to the return type:

```ts
type UseSceneResult = {
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly revealProjection: RevealProjection;
  readonly routeProjection: RouteProjection;
  readonly kinematicsRef: RefObject<Kinematics>;
};
```

And include it in the returned object:

```ts
return { state, entries, intents, onEvent, revealProjection, routeProjection, kinematicsRef };
```

Note: `snapshot.context.visited` is typed by xstate from the machine context defined in Task 5. If the typecheck complains that `context` is unknown, ensure the `useActor(sceneMachine)` import path is the same as your Task 5 edits — they share the same machine type.

- [ ] **Step 2: Forward `routeProjection` through `SceneWidget`**

In `src/features/scene/widget/scene/SceneWidget.tsx`, update the destructure and the `<Scene>` props:

```tsx
export const SceneWidget = (props: SceneWidgetProps): JSX.Element => {
  const {
    state,
    entries,
    intents,
    onEvent,
    revealProjection,
    routeProjection,
    kinematicsRef,
  } = useScene();

  return (
    <>
      <Canvas style={CANVAS_WRAPPER_STYLE} dpr={[1, 2]}>
        <Scene
          ship={props.ship}
          state={state}
          entries={entries}
          intents={intents}
          onEvent={onEvent}
          kinematicsRef={kinematicsRef}
          routeProjection={routeProjection}
        />
      </Canvas>
      <CompanyInfoPanel projection={revealProjection} />
      <CommsDockWidget kinematicsRef={kinematicsRef} sceneState={state} />
    </>
  );
};
```

- [ ] **Step 3: Accept `routeProjection` in `<Scene>` and mount waypoint components**

In `src/features/scene/components/Scene/Scene.tsx`, add the imports:

```ts
import type { RouteProjection } from '../../types/route-projection';
import { WaypointBeam } from './WaypointBeam';
import { WaypointMarker } from './WaypointMarker';
```

Extend `SceneProps`:

```ts
type SceneProps = {
  readonly ship: ShipEntry;
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly routeProjection: RouteProjection;
};
```

Inside the returned JSX, mount `<WaypointBeam>` and `<WaypointMarker>` after `<PlanetLabels>`:

```tsx
<PlanetLabels labels={labels} />
<WaypointBeam projection={props.routeProjection} />
<WaypointMarker projection={props.routeProjection} kinematicsRef={props.kinematicsRef} />
<ProximityWatcher
  sceneState={props.state}
  entries={props.entries}
  kinematicsRef={props.kinematicsRef}
  planetRadiiRef={planetRadiiRef}
  planetActivationsRef={planetActivationsRef}
  onEvent={props.onEvent}
/>
```

Also extend the existing `Scene.test.tsx`. The existing `mount` helper doesn't pass `routeProjection`. Add a default:

In `src/features/scene/components/Scene/Scene.test.tsx`, add an import:

```ts
import type { RouteProjection } from '../../types/route-projection';
```

Add a constant default:

```ts
const EMPTY_ROUTE: RouteProjection = {
  kind: 'pre_route',
  firstTarget: { id: acme, placement: [5, 0, 0] },
};
```

Update `mount` to pass it:

```tsx
const mount = (
  state: SceneState,
  entries: ReadonlyArray<CompanyEntry>,
  intents: IntentStream,
  onEvent: (event: SceneEvent) => void,
): void => {
  render(
    <Scene
      ship={testShip}
      state={state}
      entries={entries}
      intents={intents}
      onEvent={onEvent}
      kinematicsRef={createKinematicsRef()}
      routeProjection={EMPTY_ROUTE}
    />,
  );
};
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`

Expected: green.

- [ ] **Step 5: Smoke-verify in the browser**

Run: `pnpm dev`

Open the dev URL (`http://localhost:5173` by default). Pick a ship; the scene should boot showing planets along +Z, with Saturn closest, sun at the far end. Verify:

- Forward (W) flies toward planets; entering Saturn's activation zone reveals the Mave info panel.
- After visiting Saturn, a faint cyan beam appears connecting Saturn to Jupiter.
- Holding Space accelerates the ship; trail shifts toward hot-white-cyan; FOV widens.
- Entering Jupiter's activation zone cuts the boost; FOV and trail return to base.
- Filler planets (Mercury, Uranus, Neptune) are visible and solid; the ship bumps off them but no info panel appears.

This is a manual verification step. Any visible regression is a sign to revisit the relevant task.

- [ ] **Step 6: Commit**

```bash
git add src/features/scene/widget/scene/useScene.ts \
        src/features/scene/widget/scene/SceneWidget.tsx \
        src/features/scene/components/Scene/Scene.tsx \
        src/features/scene/components/Scene/Scene.test.tsx
git commit -m "$(cat <<'EOF'
feat(scene): mount WaypointBeam + WaypointMarker; route projection wiring

useScene derives RouteProjection from sceneMachine.context.visited +
companies entries + CAREER_ROUTE_ORDER and exposes it. SceneWidget forwards
to <Scene>, which mounts both Waypoint components inside the Canvas. The
3D beam follows the projection's anchor → nextTarget; the HUD marker
edge-clamps + distance-pills when the next target is off-camera.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done — Acceptance Pass

After Task 15, run a final acceptance pass against the spec's criteria:

- [ ] `pnpm check` is green (typecheck + lint + suppressor scan + tests).
- [ ] No `@ts-ignore`, postfix `!` on lookups, `as` casts on lookups, or `eslint-disable` / `oxlint-disable` comments anywhere in the diff (`git diff main` then grep).
- [ ] Dev server boots; ship selector works; the scene shows planets in the Saturn→Venus order along +Z with sun at the terminus.
- [ ] All five career reveals fire in sequence on a straight-forward flight from start.
- [ ] Boost (hold Space) accelerates, cross-fades the trail to hot-white-cyan, widens FOV, extends look-ahead; auto-cuts on planet activation entry.
- [ ] After at least one visit, a soft cyan beam appears from the most recently visited planet to the next career stop.
- [ ] When the next career stop is off-camera, a screen-edge chevron + distance pill appears at the closest viewport edge.
- [ ] Out-of-order visit (e.g. fly to Venus first): waypoint correctly points back at Saturn, projection stays coherent.
- [ ] Filler planets render at off-axis positions, are solid (ship cannot enter their bodies), and produce no info panel.

If any item fails, re-open the relevant task and address it. Each task is self-contained — re-running it doesn't ripple changes through the chain.
