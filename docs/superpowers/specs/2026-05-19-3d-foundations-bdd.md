# 3D Foundations — BDD Scenarios

**Date:** 2026-05-19
**Status:** Port-targeted Gherkin scenarios for the foundations build defined in [2026-05-19-3d-renderer-design.md § Foundations scope](./2026-05-19-3d-renderer-design.md#foundations-scope-next-session).
**Companion:** [2026-05-19-3d-foundations-tdd.md](./2026-05-19-3d-foundations-tdd.md)

---

## Reading rules

- Every scenario describes **observable behavior crossing a port**: parsed types in, parsed types or events out.
- No scenario references implementation tooling (renderer engine, reconciler, hook names, DOM canvas, refs). Implementation can be swapped without rewording.
- One scenario per behavior. Outlines parameterize keys / axes / boundaries.
- The ports under test are exactly those in the design spec's *Port shape* section: `SceneState`, `Intent`, `IntentStream`, `SceneEvent`, `Company`, `CompanyId`, `SceneProps`. Pure-math services have plain-record `{ x; y; z }` signatures.

---

## Feature: Keyboard adapter → IntentStream

The keyboard adapter is the input port between the browser keyboard and the `IntentStream.current` Set. Holding a movement key adds an `Intent['kind']` to the set; releasing removes it. Multiple held keys coexist as separate entries.

> **Note on the `intent` Set granularity.** Per the design's port shape, `IntentStream.current` is `ReadonlySet<Intent['kind']>` — i.e. the discriminator only, not full `Intent` records. Holding W and S simultaneously results in a single `'thrust'` entry; the forward/backward axis is **not** preserved in this stream. The kinematic math service must derive axis from a richer signal (see *Gap A* in the companion TDD doc's "Spec gaps" section).

### Scenario: starting an empty stream
- **Given** the keyboard adapter has been attached and no keys are held
- **Then** `intents.current` is the empty set

### Scenario Outline: a single movement key produces its intent kind
- **Given** the keyboard adapter is attached
- **When** the user presses and holds `<key>`
- **Then** `intents.current` contains `<intent-kind>` and nothing else

| key         | intent-kind |
| ----------- | ----------- |
| W           | thrust      |
| S           | thrust      |
| ArrowUp     | thrust      |
| ArrowDown   | thrust      |
| A           | turn        |
| D           | turn        |
| ArrowLeft   | turn        |
| ArrowRight  | turn        |

### Scenario: releasing a held key removes its intent
- **Given** the user is holding W and `intents.current` contains `thrust`
- **When** the user releases W
- **Then** `intents.current` is the empty set

### Scenario: multiple held keys coexist as distinct entries
- **Given** the keyboard adapter is attached and no keys are held
- **When** the user presses and holds W and A
- **Then** `intents.current` contains `thrust` and `turn` and nothing else

### Scenario: two keys mapping to the same kind collapse into one entry
- **Given** the keyboard adapter is attached
- **When** the user presses and holds W and ArrowUp together
- **Then** `intents.current` contains `thrust` and nothing else
- **And when** the user releases W only
- **Then** `intents.current` still contains `thrust`
- **And when** the user releases ArrowUp
- **Then** `intents.current` is the empty set

### Scenario: keys outside the movement map are ignored
- **Given** the keyboard adapter is attached
- **When** the user presses and holds the key `Q`
- **Then** `intents.current` is the empty set

### Scenario: rapid press and release returns to empty
- **Given** the keyboard adapter is attached
- **When** the user presses D then releases D within a few milliseconds
- **Then** `intents.current` is the empty set after release

### Scenario: stream identity is stable across reads
- **Given** the keyboard adapter is attached and the user is holding W
- **When** the same `intents` object is read on two consecutive frames
- **Then** both reads observe `thrust` is present in `current`
- **And** no consumer needs to re-subscribe between reads

---

## Feature: Renderer math — integrateMotion (pure)

`integrateMotion` produces a new kinematic state from the previous one and the active intents, in continuous time. Smooth — delta scales with `dt`. No teleport. Pure: same inputs ⇒ same outputs; no hidden state.

### Scenario: idle with no intents preserves position and velocity
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:0}`, no active intents, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned position is `{x:0, y:0, z:0}`
- **And** the returned velocity is `{x:0, y:0, z:0}`

### Scenario: thrust forward accelerates along heading
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:0}`, heading along +Z, intent `thrust` (forward axis), and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity's component along the heading axis is greater than zero
- **And** the returned position has advanced along the heading axis by an amount strictly less than the velocity change (because acceleration ramps within the frame)

### Scenario: thrust backward decelerates relative to forward direction
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:10}`, heading along +Z, intent `thrust` (backward axis), and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity along +Z is strictly less than 10
- **And** strictly greater than zero (single-frame deceleration does not overshoot)

### Scenario: brake reduces speed toward zero
- **Given** velocity `{x:0, y:0, z:10}`, intent `brake`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity magnitude is strictly less than the input magnitude
- **And** the returned velocity is in the same direction as the input (does not reverse)

### Scenario: brake from rest stays at rest
- **Given** velocity `{x:0, y:0, z:0}`, intent `brake`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity is `{x:0, y:0, z:0}`

### Scenario: turn left rotates heading counter-clockwise
- **Given** heading along +Z, intent `turn` (left direction), and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned heading has rotated by a positive angle around the up axis (counter-clockwise viewed from above)
- **And** the magnitude of the rotation is proportional to `dt`

### Scenario: turn right rotates heading clockwise
- **Given** heading along +Z, intent `turn` (right direction), and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned heading has rotated by a negative angle around the up axis
- **And** the magnitude of the rotation is proportional to `dt`

### Scenario: motion is smooth — position delta scales with dt
- **Given** identical inputs A and B differing only in `dt` (A uses 0.016, B uses 0.032)
- **When** `integrateMotion` runs for each
- **Then** the magnitude of position change in B is approximately twice that of A
- **And** neither result is a teleport (no instantaneous large step)

### Scenario: integration is pure — no input mutation
- **Given** an input position and velocity object
- **When** `integrateMotion` runs
- **Then** the original input objects are deeply equal to their pre-call snapshot

### Scenario: combined thrust and turn applies both
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:0}`, intents `thrust` (forward) and `turn` (left), and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity has gained forward magnitude
- **And** the returned heading has rotated counter-clockwise

---

## Feature: Renderer math — proximityCheck (pure)

`proximityCheck` returns the set of company ids currently within `radius` of the player position. Pure plain-record signatures.

### Scenario: empty world returns empty set
- **Given** a player at `{x:0, y:0, z:0}`, no companies, and `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set is empty

### Scenario: a company inside radius is included
- **Given** a player at `{x:0, y:0, z:0}` and one company at `{x:2, y:0, z:0}` with `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set contains that company's id and nothing else

### Scenario: a company outside radius is excluded
- **Given** a player at `{x:0, y:0, z:0}` and one company at `{x:10, y:0, z:0}` with `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set is empty

### Scenario: a company exactly on the radius boundary is included
- **Given** a player at `{x:0, y:0, z:0}` and one company at `{x:5, y:0, z:0}` with `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set contains that company's id

### Scenario: distance is computed in three dimensions
- **Given** a player at `{x:0, y:0, z:0}`, one company at `{x:3, y:4, z:0}`, one at `{x:3, y:4, z:1}`, with `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set contains the first company's id (distance = 5)
- **And** does not contain the second company's id (distance > 5)

### Scenario: multiple companies are evaluated independently
- **Given** a player at `{x:0, y:0, z:0}`, three companies at `{x:1, y:0, z:0}`, `{x:0, y:0, z:100}`, `{x:0, y:2, z:0}`, with `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set contains exactly the ids of the first and third companies

### Scenario: proximity check does not mutate inputs
- **Given** a player position object and a companies array
- **When** `proximityCheck` runs
- **Then** the player position object and each company object are deeply equal to their pre-call snapshots

---

## Feature: Renderer math — clampToBounds (pure)

`clampToBounds` returns a position guaranteed to lie inside the given axis-aligned bounds. Pure plain-record signatures.

### Scenario: a position already inside bounds is returned unchanged
- **Given** position `{x:1, y:2, z:3}` and bounds `{min:{x:-10,y:-10,z:-10}, max:{x:10,y:10,z:10}}`
- **When** `clampToBounds` runs
- **Then** the returned position equals `{x:1, y:2, z:3}`

### Scenario Outline: a position outside bounds is clamped onto the nearest face
- **Given** position `<input>` and bounds `{min:{x:-10,y:-10,z:-10}, max:{x:10,y:10,z:10}}`
- **When** `clampToBounds` runs
- **Then** the returned position equals `<expected>`

| input                  | expected               |
| ---------------------- | ---------------------- |
| `{x: 50, y: 0, z: 0}`  | `{x: 10, y: 0, z: 0}`  |
| `{x:-50, y: 0, z: 0}`  | `{x:-10, y: 0, z: 0}`  |
| `{x: 0, y: 50, z: 0}`  | `{x: 0, y: 10, z: 0}`  |
| `{x: 0, y:-50, z: 0}`  | `{x: 0, y:-10, z: 0}`  |
| `{x: 0, y: 0, z: 50}`  | `{x: 0, y: 0, z: 10}`  |
| `{x: 0, y: 0, z:-50}`  | `{x: 0, y: 0, z:-10}`  |

### Scenario: a position outside bounds on multiple axes clamps each axis independently
- **Given** position `{x:50, y:-50, z:5}` and bounds `{min:{x:-10,y:-10,z:-10}, max:{x:10,y:10,z:10}}`
- **When** `clampToBounds` runs
- **Then** the returned position equals `{x:10, y:-10, z:5}`

### Scenario: a position exactly on a face stays on that face
- **Given** position `{x:10, y:0, z:0}` and bounds `{min:{x:-10,y:-10,z:-10}, max:{x:10,y:10,z:10}}`
- **When** `clampToBounds` runs
- **Then** the returned position equals `{x:10, y:0, z:0}`

### Scenario: clamping does not mutate inputs
- **Given** a position object and a bounds object
- **When** `clampToBounds` runs
- **Then** both inputs are deeply equal to their pre-call snapshots

---

## Feature: Scene component contract (`SceneProps`)

The Scene component consumes the `SceneProps` port — `state`, `companies`, `intents`, `onEvent` — and emits `SceneEvent`s through `onEvent`. The component must not mutate inputs and must emit each proximity transition exactly once.

> **Note on the test harness.** The Scene's underlying renderer needs a graphics surface in the real app. These scenarios speak only about props in and `onEvent` out — the harness used to satisfy them is implementation detail. The implementer chooses a renderer-free or headless harness; the scenarios do not change.

### Scenario: mounting with `loading` state emits no events
- **Given** valid companies and an `IntentStream` whose `current` is empty
- **When** the Scene is rendered with `state = { kind: 'loading' }`
- **Then** `onEvent` is not called

### Scenario: mounting with `playing` state and no nearby companies emits no proximity events
- **Given** the player position is far from every company in `companies`
- **When** the Scene is rendered with `state = { kind: 'playing' }`
- **Then** `onEvent` is not called with any `entered_proximity` event

### Scenario: entering proximity of a company emits exactly one `entered_proximity` event
- **Given** a company with id `acme` placed within proximity radius of the player's starting position
- **And** an `IntentStream` configured to drive motion toward `acme` (or with the player already in range from frame zero)
- **When** the Scene is rendered with `state = { kind: 'playing' }` and at least one frame is integrated
- **Then** `onEvent` is called with `{ kind: 'entered_proximity', objectId: 'acme' }` exactly once

### Scenario: repeat entry while still inside radius emits no further events
- **Given** the player has entered proximity of `acme` and `onEvent` was called with `entered_proximity`
- **When** further frames are integrated and the player remains inside the radius
- **Then** `onEvent` is not called again with `entered_proximity` for `acme`

### Scenario: exiting proximity emits exactly one `exited_proximity` event
- **Given** the player is inside proximity of `acme` and has already emitted `entered_proximity`
- **When** further frames cause the player to leave the radius around `acme`
- **Then** `onEvent` is called with `{ kind: 'exited_proximity', objectId: 'acme' }` exactly once

### Scenario: re-entering after exit emits a new `entered_proximity` event
- **Given** the player previously entered and then exited proximity of `acme`
- **When** the player crosses back into the radius around `acme`
- **Then** `onEvent` is called with `{ kind: 'entered_proximity', objectId: 'acme' }` a second time

### Scenario: proximity events are emitted per company independently
- **Given** companies `acme` and `globex`, both placed such that the player passes through their radii in sequence
- **When** the player enters and exits each in turn
- **Then** `onEvent` is called with `entered_proximity` and `exited_proximity` once each for `acme`, and once each for `globex`

### Scenario: pressing the interact key emits `interact_pressed`
- **Given** an `IntentStream` whose `current` newly includes `interact` on the current frame and did not include it on the previous frame
- **When** the Scene is rendered with `state = { kind: 'playing' }` and a frame is integrated
- **Then** `onEvent` is called with `{ kind: 'interact_pressed' }` exactly once

### Scenario: holding interact across frames does not re-emit
- **Given** `interact` has already produced an `interact_pressed` event on a previous frame and remains in `intents.current`
- **When** further frames are integrated
- **Then** `onEvent` is not called again with `interact_pressed` while the intent remains continuously held

### Scenario: Scene does not mutate `companies` or `intents`
- **Given** a `companies` array and an `IntentStream` object passed as props
- **When** the Scene renders and integrates at least one frame
- **Then** the `companies` array contents and the `IntentStream` object's identity are unchanged by the Scene
- **And** any mutation of `intents.current` (the set) came from the keyboard adapter, never the Scene

### Scenario: state `paused` halts proximity event emission
- **Given** the player is moving inside proximity radii and would emit events under `playing`
- **When** the Scene is rendered with `state = { kind: 'paused' }`
- **Then** `onEvent` is not called with any `entered_proximity` or `exited_proximity` event while paused

### Scenario: state `revealing { objectId }` does not re-emit `entered_proximity` for the same id
- **Given** the player is inside the radius of `acme` and `state = { kind: 'revealing', objectId: 'acme' }`
- **When** further frames are integrated and the player remains inside the radius
- **Then** `onEvent` is not called with `entered_proximity` for `acme`

---

## Feature: Scene state machine (stub)

The machine is a pure function `(state, event) → state` over `SceneState` and `SceneEvent`. It owns the discrete-state transitions for the scene. No React, no DOM.

> **`paused` toggle path.** The spec offers two possible triggers for pause: an `interact_pressed` event, or an Escape key handled in the keyboard adapter. **This spec picks the `interact_pressed` event path.** Rationale: the machine's port is `SceneEvent`, so pause is most consistent as another event. The keyboard adapter is unaware of "pause" semantics; it emits intents only. The widget composition root is responsible for translating an `interact` intent into an `interact_pressed` event on press-edge.

### Scenario: initial state is `loading`
- **Given** the machine has just been created
- **Then** its current state is `{ kind: 'loading' }`

### Scenario: `loading` becomes `playing` on mount
- **Given** the machine is in `{ kind: 'loading' }`
- **When** the `mount` transition fires (entry on mount)
- **Then** the machine is in `{ kind: 'playing' }`

### Scenario: `playing` becomes `revealing` on `entered_proximity`
- **Given** the machine is in `{ kind: 'playing' }`
- **When** an event `{ kind: 'entered_proximity', objectId: 'acme' }` is processed
- **Then** the machine is in `{ kind: 'revealing', objectId: 'acme' }`

### Scenario: `revealing` becomes `playing` on `exited_proximity` for the same id
- **Given** the machine is in `{ kind: 'revealing', objectId: 'acme' }`
- **When** an event `{ kind: 'exited_proximity', objectId: 'acme' }` is processed
- **Then** the machine is in `{ kind: 'playing' }`

### Scenario: `revealing` ignores `exited_proximity` for a different id
- **Given** the machine is in `{ kind: 'revealing', objectId: 'acme' }`
- **When** an event `{ kind: 'exited_proximity', objectId: 'globex' }` is processed
- **Then** the machine is still in `{ kind: 'revealing', objectId: 'acme' }`

### Scenario: `playing` toggles to `paused` on `interact_pressed`
- **Given** the machine is in `{ kind: 'playing' }`
- **When** an event `{ kind: 'interact_pressed' }` is processed
- **Then** the machine is in `{ kind: 'paused' }`

### Scenario: `revealing` toggles to `paused` on `interact_pressed`
- **Given** the machine is in `{ kind: 'revealing', objectId: 'acme' }`
- **When** an event `{ kind: 'interact_pressed' }` is processed
- **Then** the machine is in `{ kind: 'paused' }`

### Scenario: `paused` returns to `playing` on `interact_pressed`
- **Given** the machine is in `{ kind: 'paused' }`
- **When** an event `{ kind: 'interact_pressed' }` is processed
- **Then** the machine is in `{ kind: 'playing' }`

### Scenario: `paused` ignores proximity events
- **Given** the machine is in `{ kind: 'paused' }`
- **When** an event `{ kind: 'entered_proximity', objectId: 'acme' }` is processed
- **Then** the machine is still in `{ kind: 'paused' }`
- **And when** an event `{ kind: 'exited_proximity', objectId: 'acme' }` is processed
- **Then** the machine is still in `{ kind: 'paused' }`

### Scenario: `loading` ignores all events except `mount`
- **Given** the machine is in `{ kind: 'loading' }`
- **When** any of `entered_proximity`, `exited_proximity`, or `interact_pressed` is processed
- **Then** the machine is still in `{ kind: 'loading' }`

---

## Feature: End-to-end smoke at the root route

The home route mounts the Scene widget. This scenario lives at the route boundary — it asserts only what crosses from URL to screen.

### Scenario: visiting `/` mounts a scene
- **Given** the dev server is running
- **When** the user opens `/`
- **Then** the rendered tree includes the scene widget's root output (no error, no placeholder text)

### Scenario: holding a movement key drives proximity-event logging
- **Given** the user is on `/`
- **When** the user presses and holds movement keys long enough for the player to enter the proximity radius of any company
- **Then** an `entered_proximity` log line appears in the console with an `objectId` matching one of the companies in the seed list
- **And when** the user continues holding keys until the player leaves that radius
- **Then** an `exited_proximity` log line appears in the console with the same `objectId`

---

## Coverage checklist

- [x] Every Foundations-scope behavior has at least one scenario.
- [x] Every action has at least one failure / no-op path (releases, exits, ignored events, no-op states).
- [x] Async / lifecycle: `loading → playing` on mount, multi-frame proximity transitions, repeat-press suppression.
- [x] Empty / zero states: empty stream, empty companies, idle motion, brake-from-rest, no-keys-held.
- [x] Boundary values: `proximityCheck` exactly on radius, `clampToBounds` exactly on face, single-frame deceleration not overshooting.
- [x] Purity: no mutation of inputs in any pure-math service or the Scene component.
- [x] Concurrent / rapid action edges: multi-key holds collapsing into one intent kind, rapid press-release, re-entry after exit.
- [x] Discriminator integrity: `revealing` carries `objectId`, `exited_proximity` for non-matching id is ignored, `paused` ignores proximity.
- [x] A11y / focus: out of scope per the design spec's "Out of scope (explicitly)" list. No scenarios written. Surface upward if this proves wrong.

---

## Self-check (against the BDD agent contract)

1. Every scenario reads as observable behavior crossing a port — props in, parsed-type events out. **Pass.**
2. No scenario references an internal function, hook, ref, or framework name. **Pass.** (One implementation-flavored aside in the "Note on the test harness" callout, framed as guidance for the implementer, not part of any scenario.)
3. Could the implementation be rewritten in a different renderer / reconciler / state-machine library and every scenario still make sense? **Pass.** Re-read with that lens performed.
4. Every assertion is load-bearing — none merely restates the type system. **Pass.** Scenarios assert *behavior under inputs*, not *which kinds exist in the union*. Where the type-system constraint matters (e.g. `revealing` carries `objectId`), the scenario tests the **discriminator-driven behavior**, not the field's existence.
