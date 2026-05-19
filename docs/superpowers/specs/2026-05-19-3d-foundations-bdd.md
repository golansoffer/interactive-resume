# 3D Foundations — BDD Scenarios

**Date:** 2026-05-19
**Status:** Port-targeted Gherkin scenarios for the foundations build defined in [2026-05-19-3d-renderer-design.md § Foundations scope](./2026-05-19-3d-renderer-design.md#foundations-scope-next-session).
**Companion:** [2026-05-19-3d-foundations-tdd.md](./2026-05-19-3d-foundations-tdd.md)

---

## Reading rules

- Every scenario describes **observable behavior crossing a port**: parsed types in, parsed types or events out.
- No scenario references implementation tooling (renderer engine, reconciler, hook names, refs, framework names). Implementation can be swapped without rewording.
- One scenario per behavior. Outlines parameterize keys / boundaries.
- The ports under test are exactly those in the design spec's *Port shape* section: `SceneState`, `PausedResume`, `Intent`, `IntentStream`, `KeyboardCommand`, `KeyboardSignal`, `SceneEvent`, `Company`, `CompanyId`, `SceneProps`. Pure-math services have plain-record `{ x; y; z }` signatures.

---

## Feature: Keyboard adapter (`subscribeToKeyboard`)

The keyboard adapter is the input port between the browser keyboard and the rest of the app. It accepts a single `onSignal: (signal: KeyboardSignal) => void` callback and returns an unsubscribe function. Continuous keys emit `intent_down` / `intent_up`; discrete keys emit `command` on keydown only (auto-repeat suppressed). The adapter is pure — no React.

### Scenario: attaching the adapter emits no signals on its own
- **Given** `subscribeToKeyboard(onSignal)` has just been called
- **And** no key events have fired
- **Then** `onSignal` has not been called

### Scenario Outline: pressing a continuous movement key emits `intent_down` with the mapped intent kind
- **Given** the keyboard adapter is attached
- **When** the user presses `<key>`
- **Then** `onSignal` is called with `{ kind: 'intent_down', intent: '<intent-kind>' }`

| key          | intent-kind       |
| ------------ | ----------------- |
| `W`          | `thrust_forward`  |
| `ArrowUp`    | `thrust_forward`  |
| `S`          | `thrust_backward` |
| `ArrowDown`  | `thrust_backward` |
| `A`          | `turn_left`       |
| `ArrowLeft`  | `turn_left`       |
| `D`          | `turn_right`      |
| `ArrowRight` | `turn_right`      |
| `Space`      | `brake`           |

### Scenario Outline: releasing a continuous movement key emits `intent_up` with the matching intent kind
- **Given** the keyboard adapter is attached and the user is holding `<key>`
- **When** the user releases `<key>`
- **Then** `onSignal` is called with `{ kind: 'intent_up', intent: '<intent-kind>' }`

| key          | intent-kind       |
| ------------ | ----------------- |
| `W`          | `thrust_forward`  |
| `ArrowUp`    | `thrust_forward`  |
| `S`          | `thrust_backward` |
| `ArrowDown`  | `thrust_backward` |
| `A`          | `turn_left`       |
| `ArrowLeft`  | `turn_left`       |
| `D`          | `turn_right`      |
| `ArrowRight` | `turn_right`      |
| `Space`      | `brake`           |

### Scenario: holding a continuous key does not re-emit `intent_down` from auto-repeat
- **Given** the keyboard adapter is attached and the user has pressed `W`
- **When** the OS auto-repeats the `W` keydown event
- **Then** `onSignal` is not called again with `{ kind: 'intent_down', intent: 'thrust_forward' }`

### Scenario Outline: pressing a discrete command key emits a `command` signal
- **Given** the keyboard adapter is attached
- **When** the user presses `<key>`
- **Then** `onSignal` is called with `{ kind: 'command', command: { kind: '<command-kind>' } }`

| key      | command-kind   |
| -------- | -------------- |
| `E`      | `interact`     |
| `Escape` | `pause_toggle` |

### Scenario: holding a discrete command key does not re-emit on auto-repeat
- **Given** the keyboard adapter is attached and the user has pressed `E`
- **When** the OS auto-repeats the `E` keydown event
- **Then** `onSignal` is not called a second time with `{ kind: 'command', command: { kind: 'interact' } }`

### Scenario: releasing a discrete command key emits no signal
- **Given** the keyboard adapter is attached and `E` has been pressed
- **When** the user releases `E`
- **Then** `onSignal` is not called with any new signal as a result of the release

### Scenario: keys outside the mapped set emit no signals
- **Given** the keyboard adapter is attached
- **When** the user presses and releases `Q`
- **Then** `onSignal` is not called

### Scenario: calling the returned unsubscribe stops further signals
- **Given** `subscribeToKeyboard(onSignal)` was called and the returned `unsubscribe()` has been invoked
- **When** the user presses any mapped key
- **Then** `onSignal` is not called

### Scenario: simultaneous opposing continuous keys are independent signals
- **Given** the keyboard adapter is attached
- **When** the user presses `W` and then presses `S` without releasing `W`
- **Then** `onSignal` is called with `{ kind: 'intent_down', intent: 'thrust_forward' }`
- **And then** `onSignal` is called with `{ kind: 'intent_down', intent: 'thrust_backward' }`

---

## Feature: Renderer math — `integrateMotion` (pure)

`integrateMotion` produces a new kinematic state from the previous one and the active intent set, in continuous time. Inputs are plain records; the active intents are passed as `ReadonlySet<Intent['kind']>`. Pure: same inputs ⇒ same outputs; no input mutation.

### Scenario: idle with no intents preserves position
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:0}`, active intents are the empty set, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned position equals `{x:0, y:0, z:0}`
- **And** the returned velocity equals `{x:0, y:0, z:0}`

### Scenario: existing velocity carries the position forward when no intents are active
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:10}`, active intents are the empty set, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned position's `z` is greater than `0`
- **And** the returned velocity equals `{x:0, y:0, z:10}` (no acceleration without intent)

### Scenario: `thrust_forward` accelerates along heading
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:0}`, heading along `+Z`, active intents include `thrust_forward`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity has a positive component along `+Z`

### Scenario: `thrust_backward` accelerates opposite to heading
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:0}`, heading along `+Z`, active intents include `thrust_backward`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity has a negative component along `+Z`

### Scenario: `brake` reduces speed magnitude
- **Given** velocity `{x:0, y:0, z:10}`, active intents include `brake`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the magnitude of the returned velocity is strictly less than `10`
- **And** the returned velocity is in the same direction as the input (no sign flip on a single frame)

### Scenario: `brake` from rest stays at rest
- **Given** velocity `{x:0, y:0, z:0}`, active intents include `brake`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity equals `{x:0, y:0, z:0}`

### Scenario: `turn_left` rotates heading counter-clockwise around the up axis
- **Given** heading along `+Z`, active intents include `turn_left`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned heading has rotated by a positive angle around the up axis (counter-clockwise viewed from above)

### Scenario: `turn_right` rotates heading clockwise around the up axis
- **Given** heading along `+Z`, active intents include `turn_right`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned heading has rotated by a negative angle around the up axis

### Scenario: opposing thrust intents cancel
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:0}`, active intents include both `thrust_forward` and `thrust_backward`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity equals `{x:0, y:0, z:0}` (net acceleration is zero)

### Scenario: opposing turn intents cancel
- **Given** heading along `+Z`, active intents include both `turn_left` and `turn_right`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned heading is unchanged from the input heading

### Scenario: thrust and turn combine
- **Given** position `{x:0, y:0, z:0}`, velocity `{x:0, y:0, z:0}`, active intents include `thrust_forward` and `turn_left`, and `dt = 0.016`
- **When** `integrateMotion` runs
- **Then** the returned velocity has gained forward magnitude
- **And** the returned heading has rotated counter-clockwise

### Scenario: motion is continuous — position delta scales with `dt`
- **Given** identical inputs A and B differing only in `dt` (A uses `0.016`, B uses `0.032`)
- **When** `integrateMotion` runs for each
- **Then** the magnitude of position change in B is approximately twice that of A

### Scenario: integration is pure — inputs are not mutated
- **Given** the input position, velocity, and active-intents set
- **When** `integrateMotion` runs
- **Then** each input value is deeply equal to its pre-call snapshot

---

## Feature: Renderer math — `proximityCheck` (pure)

`proximityCheck(playerPosition, companies, radius)` returns the set of `CompanyId`s currently within `radius` of `playerPosition`. Plain-record signatures. Radius is a parameter so the math is testable with different radii. Pure.

### Scenario: empty companies list returns the empty set
- **Given** a player at `{x:0, y:0, z:0}`, no companies, and `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set is empty

### Scenario: a company inside the radius is included
- **Given** a player at `{x:0, y:0, z:0}` and one company at `{x:2, y:0, z:0}` with `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set contains that company's id and nothing else

### Scenario: a company strictly outside the radius is excluded
- **Given** a player at `{x:0, y:0, z:0}` and one company at `{x:10, y:0, z:0}` with `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set is empty

### Scenario: a company exactly on the radius boundary is included
- **Given** a player at `{x:0, y:0, z:0}` and one company at `{x:5, y:0, z:0}` with `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set contains that company's id

### Scenario: distance is Euclidean across all three axes
- **Given** a player at `{x:0, y:0, z:0}`, one company at `{x:3, y:4, z:0}` (distance `5`), one at `{x:3, y:4, z:1}` (distance > `5`), and `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set contains the first company's id
- **And** does not contain the second company's id

### Scenario: each company is evaluated independently
- **Given** a player at `{x:0, y:0, z:0}`, companies at `{x:1, y:0, z:0}`, `{x:0, y:0, z:100}`, and `{x:0, y:2, z:0}`, with `radius = 5`
- **When** `proximityCheck` runs
- **Then** the returned set contains exactly the ids of the first and third companies

### Scenario: the radius is honored independently per call
- **Given** a player at `{x:0, y:0, z:0}` and one company at `{x:4, y:0, z:0}`
- **When** `proximityCheck` runs with `radius = 5`
- **Then** the returned set contains that company's id
- **And when** `proximityCheck` runs with `radius = 3` on the same inputs
- **Then** the returned set is empty

### Scenario: proximity check does not mutate inputs
- **Given** the player position, the companies array, and any individual company object
- **When** `proximityCheck` runs
- **Then** each input value is deeply equal to its pre-call snapshot

---

## Feature: Renderer math — `clampToBounds` (pure)

`clampToBounds` returns a position guaranteed to lie inside the given axis-aligned bounds. Pure plain-record signatures.

### Scenario: a position already inside bounds is returned unchanged
- **Given** position `{x:1, y:2, z:3}` and bounds `{min:{x:-10,y:-10,z:-10}, max:{x:10,y:10,z:10}}`
- **When** `clampToBounds` runs
- **Then** the returned position equals `{x:1, y:2, z:3}`

### Scenario Outline: a position outside bounds on a single axis is clamped to the nearest face
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

### Scenario: a position outside bounds on multiple axes is clamped per-axis
- **Given** position `{x:50, y:-50, z:5}` and bounds `{min:{x:-10,y:-10,z:-10}, max:{x:10,y:10,z:10}}`
- **When** `clampToBounds` runs
- **Then** the returned position equals `{x:10, y:-10, z:5}`

### Scenario: a position exactly on a face is returned on that face
- **Given** position `{x:10, y:0, z:0}` and bounds `{min:{x:-10,y:-10,z:-10}, max:{x:10,y:10,z:10}}`
- **When** `clampToBounds` runs
- **Then** the returned position equals `{x:10, y:0, z:0}`

### Scenario: clamping does not mutate inputs
- **Given** a position object and a bounds object
- **When** `clampToBounds` runs
- **Then** both inputs are deeply equal to their pre-call snapshots

---

## Feature: Scene state machine (`sceneMachine`)

The machine is a pure XState v5 machine in `core/scene/sceneMachine.ts`. Its event union uses XState's `type` field — these scenarios describe the observable transition behavior in domain terms. The widget translates from the domain `kind` to XState `type` at `actor.send`; that translation is implementation detail and is not under test here.

The machine's events (as the widget sends them):
- `start` — triggers `loading → playing`.
- `pause_toggle` — toggles into / out of `paused`.
- `interact` — discrete user command (see *Gap: `interact` behavior* below).
- `entered_proximity { objectId }` — proximity entry.
- `exited_proximity { objectId }` — proximity exit.

### Scenario: initial state is `loading`
- **Given** the machine has just been started
- **Then** its current state is `{ kind: 'loading' }`

### Scenario: `loading` transitions to `playing` on `start`
- **Given** the machine is in `{ kind: 'loading' }`
- **When** a `start` event is sent
- **Then** the machine is in `{ kind: 'playing' }`

### Scenario: `loading` ignores all events except `start`
- **Given** the machine is in `{ kind: 'loading' }`
- **When** any of `pause_toggle`, `entered_proximity { objectId: 'acme' }`, `exited_proximity { objectId: 'acme' }`, or `interact` is sent
- **Then** the machine is still in `{ kind: 'loading' }`

### Scenario: `playing` transitions to `revealing { objectId }` on `entered_proximity`
- **Given** the machine is in `{ kind: 'playing' }`
- **When** an `entered_proximity { objectId: 'acme' }` event is sent
- **Then** the machine is in `{ kind: 'revealing', objectId: 'acme' }`

### Scenario: `revealing { objectId }` transitions to `playing` on `exited_proximity` for the same id
- **Given** the machine is in `{ kind: 'revealing', objectId: 'acme' }`
- **When** an `exited_proximity { objectId: 'acme' }` event is sent
- **Then** the machine is in `{ kind: 'playing' }`

### Scenario: `revealing { objectId }` ignores `exited_proximity` for a different id
- **Given** the machine is in `{ kind: 'revealing', objectId: 'acme' }`
- **When** an `exited_proximity { objectId: 'globex' }` event is sent
- **Then** the machine is still in `{ kind: 'revealing', objectId: 'acme' }`

### Scenario: `playing` enters `paused { resumeTo: { kind: 'playing' } }` on `pause_toggle`
- **Given** the machine is in `{ kind: 'playing' }`
- **When** a `pause_toggle` event is sent
- **Then** the machine is in `{ kind: 'paused', resumeTo: { kind: 'playing' } }`

### Scenario: `revealing { objectId }` enters `paused { resumeTo: { kind: 'revealing', objectId } }` on `pause_toggle`
- **Given** the machine is in `{ kind: 'revealing', objectId: 'acme' }`
- **When** a `pause_toggle` event is sent
- **Then** the machine is in `{ kind: 'paused', resumeTo: { kind: 'revealing', objectId: 'acme' } }`

### Scenario: `paused` returns to `playing` on `pause_toggle` when `resumeTo.kind` is `playing`
- **Given** the machine is in `{ kind: 'paused', resumeTo: { kind: 'playing' } }`
- **When** a `pause_toggle` event is sent
- **Then** the machine is in `{ kind: 'playing' }`

### Scenario: `paused` returns to `revealing { objectId }` on `pause_toggle` when `resumeTo` carries `objectId`
- **Given** the machine is in `{ kind: 'paused', resumeTo: { kind: 'revealing', objectId: 'acme' } }`
- **When** a `pause_toggle` event is sent
- **Then** the machine is in `{ kind: 'revealing', objectId: 'acme' }`

### Scenario: `paused` ignores proximity events
- **Given** the machine is in `{ kind: 'paused', resumeTo: { kind: 'playing' } }`
- **When** an `entered_proximity { objectId: 'acme' }` event is sent
- **Then** the machine is still in `{ kind: 'paused', resumeTo: { kind: 'playing' } }`
- **And when** an `exited_proximity { objectId: 'acme' }` event is sent
- **Then** the machine is still in `{ kind: 'paused', resumeTo: { kind: 'playing' } }`

### Scenario: pause and resume preserve the `revealing` `objectId` across the round trip
- **Given** the machine is in `{ kind: 'revealing', objectId: 'acme' }`
- **When** `pause_toggle` is sent
- **And** `pause_toggle` is sent again
- **Then** the machine is in `{ kind: 'revealing', objectId: 'acme' }` (the original `objectId` is restored)

---

## Feature: Scene component contract (`SceneProps`)

The Scene component consumes the `SceneProps` port — `state`, `companies`, `intents`, `onEvent` — and emits `SceneEvent`s through `onEvent`. Per the amended port shape, `SceneEvent` is proximity-only — `entered_proximity` and `exited_proximity`. Interact and pause-toggle do not flow through `onEvent`; they reach the machine via the keyboard adapter.

### Scenario: mounting with `loading` state emits no events
- **Given** `state = { kind: 'loading' }`, valid `companies`, and an `IntentStream` whose `current` is empty
- **When** the Scene mounts
- **Then** `onEvent` is not called

### Scenario: mounting with `playing` state and no nearby companies emits no events
- **Given** `state = { kind: 'playing' }` and the player's starting position is outside every company's proximity radius
- **When** the Scene mounts and at least one frame is integrated
- **Then** `onEvent` is not called

### Scenario: crossing into a company's proximity radius emits `entered_proximity` exactly once
- **Given** `state = { kind: 'playing' }` and a company `acme` placed such that the player's motion will cross into its proximity radius
- **When** frames are integrated until the player enters the radius
- **Then** `onEvent` is called with `{ kind: 'entered_proximity', objectId: 'acme' }` exactly once

### Scenario: remaining inside a company's proximity radius does not re-emit `entered_proximity`
- **Given** `entered_proximity` has fired for `acme` and the player remains inside `acme`'s radius
- **When** further frames are integrated
- **Then** `onEvent` is not called again with `entered_proximity` for `acme`

### Scenario: crossing out of a company's proximity radius emits `exited_proximity` exactly once
- **Given** the player is inside `acme`'s proximity radius and `entered_proximity` has already fired
- **When** frames are integrated until the player leaves `acme`'s radius
- **Then** `onEvent` is called with `{ kind: 'exited_proximity', objectId: 'acme' }` exactly once

### Scenario: re-entering after exit emits a new `entered_proximity`
- **Given** the player previously entered and then exited `acme`'s proximity radius
- **When** the player crosses back into the radius
- **Then** `onEvent` is called with `{ kind: 'entered_proximity', objectId: 'acme' }` a second time

### Scenario: proximity events are independent per company
- **Given** companies `acme` and `globex` placed so the player's path crosses both radii in sequence
- **When** the player enters and exits each in turn
- **Then** `onEvent` is called with `entered_proximity` then `exited_proximity` once for `acme`, and once for `globex`

### Scenario: `paused` state suppresses proximity event emission
- **Given** the player is moving along a path that would emit proximity events under `playing`
- **When** the Scene is rendered with `state = { kind: 'paused', resumeTo: { kind: 'playing' } }` and frames are integrated
- **Then** `onEvent` is not called with any `entered_proximity` or `exited_proximity` event

### Scenario: `revealing { objectId }` state does not re-emit `entered_proximity` for the same id
- **Given** the player is inside the proximity radius of `acme` and `state = { kind: 'revealing', objectId: 'acme' }`
- **When** further frames are integrated and the player remains inside the radius
- **Then** `onEvent` is not called with `entered_proximity` for `acme`

### Scenario: `SceneEvent` carries no interact or pause kinds
- **Given** any `state`, `companies`, and `IntentStream`
- **When** frames are integrated for any duration
- **Then** every `SceneEvent` passed to `onEvent` has `kind` equal to either `entered_proximity` or `exited_proximity`

### Scenario: Scene does not mutate `companies`
- **Given** a `companies` array passed as props
- **When** the Scene renders and integrates at least one frame
- **Then** the `companies` array contents and element identities are deeply equal to the pre-mount snapshot

### Scenario: Scene does not mutate `intents`
- **Given** an `IntentStream` object passed as props
- **When** the Scene renders and integrates at least one frame
- **Then** the `IntentStream` object's identity is unchanged
- **And** the contents of `intents.current` are not written from inside Scene

### Scenario: the `onEvent` callback identity is stable across renders
- **Given** the Scene receives an `onEvent` callback from the widget composition root
- **When** the widget re-renders for any reason that does not change `onEvent`'s semantics
- **Then** the `onEvent` reference the Scene receives is the same JavaScript identity as on the prior render

---

## Feature: `CompanyId` minting invariant

`CompanyId` is a branded `string` minted by exactly one function, `asCompanyId(raw: string): CompanyId`, in `src/features/scene/types/company.ts`. The cast `as CompanyId` must appear nowhere else in source.

### Scenario: `asCompanyId` is defined in exactly one source location
- **Given** the repository's `src/` tree
- **When** the source is searched for the definition of `asCompanyId`
- **Then** exactly one definition is found, and it is in `src/features/scene/types/company.ts`

### Scenario: the `as CompanyId` cast appears in exactly one location
- **Given** the repository's `src/` tree
- **When** the source is searched for the literal `as CompanyId`
- **Then** exactly one occurrence is found, and it is inside `asCompanyId` in `src/features/scene/types/company.ts`

---

## Feature: End-to-end smoke at the root route

The home route mounts the Scene widget. This scenario lives at the route boundary — it asserts only what crosses from URL to mounted-widget.

### Scenario: visiting `/` mounts the Scene widget
- **Given** the dev server is running
- **When** the user navigates to `/`
- **Then** the rendered tree includes the Scene widget's root output (no placeholder text, no error)

---

## Coverage checklist

- [x] Every Foundations-scope behavior has at least one scenario.
- [x] Every action has at least one no-op / failure path (releases without prior press, unsubscribe stops signals, auto-repeat suppressed, ignored events on `loading` / `paused`).
- [x] Lifecycle: `loading → playing` on explicit `start` event, pause / resume round-trips, multi-frame proximity transitions.
- [x] Empty / zero states: empty companies list, empty active intent set, brake from rest, idle motion.
- [x] Boundary values: `proximityCheck` exactly on radius, `clampToBounds` exactly on face, opposing thrust / turn cancellation.
- [x] Purity: no mutation in any math service or in the Scene component.
- [x] Concurrent / rapid edges: simultaneous opposing keys, re-entry after exit, auto-repeat suppression for both continuous and discrete keys.
- [x] Discriminator integrity: `revealing` carries `objectId` across pause / resume, `exited_proximity` for a non-matching id is ignored, `paused.resumeTo` round-trips `objectId`.
- [x] Stability: `onEvent` reference identity preserved across re-renders.
- [x] Branding invariant: `asCompanyId` and `as CompanyId` each appear in exactly one source location.
- [x] A11y / focus: out of scope per the design spec's "Out of scope (explicitly)" list. No scenarios written.

---

## Self-check (against the BDD agent contract)

1. Every scenario reads as observable behavior crossing a port — props in, parsed-type events out, or `KeyboardSignal` callback invocation. **Pass.**
2. No scenario references an internal function, hook, ref, reconciler, or framework name. The state-machine feature names the framework's event-field translation only to disclaim it as implementation detail, not to test it. **Pass.**
3. Could the implementation be rewritten in a different renderer / reconciler / state-machine library and every scenario still make sense? **Pass.** The keyboard scenarios speak of `keydown` / `keyup` because that *is* the browser's port; the math scenarios speak of plain records; the Scene scenarios speak only of `SceneProps` in and `SceneEvent` out.
4. Every assertion is load-bearing — none merely restates the type system. Where the type-system constraint matters (e.g. `paused.resumeTo` carrying `objectId`), the scenario tests the **discriminator-driven behavior** through the round trip, not the field's existence. **Pass.**
