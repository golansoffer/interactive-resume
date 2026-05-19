# 3D Foundations — TDD Test Bullets

**Date:** 2026-05-19
**Status:** Test bullets for the foundations build defined in [2026-05-19-3d-renderer-design.md § Foundations scope](./2026-05-19-3d-renderer-design.md#foundations-scope-next-session).
**Companion:** [2026-05-19-3d-foundations-bdd.md](./2026-05-19-3d-foundations-bdd.md)

---

## Reading rules

- Each bullet is one `it(...)` description — plain English, action-verb led.
- Bullets describe **observable output** crossing the port under test. No bullet names a hook, ref, reconciler, renderer engine, or framework primitive. The harness used to execute the test is implementation choice; the wording does not change if it swaps.
- Each file's tests target one port and one port only — they never reach across into a sibling sub-layer. (Example: `Scene.test.tsx` does not call into the machine; `sceneMachine.test.ts` does not render anything.)
- Files are grouped by the layer-port they target. The bullet count per file is documented inline so future agents can verify nothing leaked or accumulated.

---

## File: `src/features/scene/services/renderer/integrateMotion.test.ts`

Targets the **pure kinematic integration port**. Inputs are plain records (`{x, y, z}` for position, velocity, heading) plus the active intent set (`ReadonlySet<Intent['kind']>`) and `dt`. No three.js types, no React, no DOM.

- [ ] returns the input position unchanged when the active intent set is empty and velocity is zero
- [ ] advances position along the existing velocity when the active intent set is empty and velocity is non-zero
- [ ] leaves the velocity unchanged when the active intent set is empty (no acceleration without intent)
- [ ] increases the velocity component along the heading axis when the active intent set contains `thrust_forward`
- [ ] decreases the velocity component along the heading axis when the active intent set contains `thrust_backward`
- [ ] yields a net-zero velocity change when both `thrust_forward` and `thrust_backward` are active in the same frame
- [ ] reduces the velocity magnitude when the active intent set contains `brake` and velocity is non-zero
- [ ] preserves the velocity direction (no sign flip) on a single `brake` frame applied to a non-zero velocity
- [ ] leaves a zero velocity unchanged when the active intent set contains `brake` (brake-from-rest is a no-op)
- [ ] rotates the heading counter-clockwise around the up axis when the active intent set contains `turn_left`
- [ ] rotates the heading clockwise around the up axis when the active intent set contains `turn_right`
- [ ] yields a net-zero heading change when both `turn_left` and `turn_right` are active in the same frame
- [ ] applies both translational and rotational change in the same frame when thrust and turn are both active
- [ ] scales the position delta proportionally to `dt` (motion is continuous, not teleport)
- [ ] scales the rotation magnitude proportionally to `dt`
- [ ] returns deeply unchanged input objects (no mutation of position, velocity, heading, or the active-intents set)
- [ ] returns the same output for the same inputs across repeated calls (referentially transparent)

Count: 17 bullets.

---

## File: `src/features/scene/services/renderer/proximityCheck.test.ts`

Targets the **pure proximity query port**: `(playerPosition, companies, radius) → ReadonlySet<CompanyId>`. Plain-record signatures only. Radius is a parameter (the Scene-local constant `PROXIMITY_RADIUS` is the caller's choice, not the math's).

- [ ] returns an empty set when the companies list is empty
- [ ] returns an empty set when no company lies within the radius
- [ ] returns a set containing exactly the id of a company strictly inside the radius
- [ ] excludes a company strictly outside the radius
- [ ] includes a company exactly on the radius boundary (closed-disk semantics)
- [ ] computes Euclidean distance across all three axes (a company at `(3,4,0)` is on a radius-5 boundary)
- [ ] excludes a company whose 3D distance exceeds the radius even when its 2D projection lies inside
- [ ] returns every in-range company id when several lie inside the radius (independence across companies)
- [ ] returns only in-range ids when a mixed list contains both in-range and out-of-range companies
- [ ] respects the `radius` parameter independently per call (same player + companies; different radius ⇒ different result)
- [ ] returns deeply unchanged input objects (no mutation of player position, companies array, or individual company records)
- [ ] returns a fresh set instance on each call (no cached / mutated singleton)

Count: 12 bullets.

---

## File: `src/features/scene/services/renderer/clampToBounds.test.ts`

Targets the **pure bounds-clamp port**. Plain-record signatures only.

- [ ] returns a position deeply equal to the input when the input lies strictly inside bounds
- [ ] returns a position at the `max.x` face when the input's x exceeds `max.x`
- [ ] returns a position at the `min.x` face when the input's x is below `min.x`
- [ ] returns a position at the `max.y` face when the input's y exceeds `max.y`
- [ ] returns a position at the `min.y` face when the input's y is below `min.y`
- [ ] returns a position at the `max.z` face when the input's z exceeds `max.z`
- [ ] returns a position at the `min.z` face when the input's z is below `min.z`
- [ ] clamps each axis independently when the input violates multiple axes
- [ ] returns the input unchanged when it lies exactly on a face (inclusive boundary)
- [ ] returns deeply unchanged input objects (no mutation of position or bounds)

Count: 10 bullets.

---

## File: `src/features/scene/services/input/subscribeToKeyboard.test.ts`

Targets the **keyboard adapter port**: external DOM key events in, `KeyboardSignal` callback invocations out. Signature: `subscribeToKeyboard(onSignal: (signal: KeyboardSignal) => void): (() => void)`. Pure — no React. The harness dispatches `keydown` / `keyup` events on the relevant event target (JSDOM or a fake window).

### Attachment lifecycle

- [ ] does not invoke `onSignal` when attached with no key events fired
- [ ] stops invoking `onSignal` after the returned unsubscribe function is called

### Continuous keys — `intent_down` on press

- [ ] invokes `onSignal` with `{ kind: 'intent_down', intent: 'thrust_forward' }` when `W` is pressed
- [ ] invokes `onSignal` with `{ kind: 'intent_down', intent: 'thrust_forward' }` when `ArrowUp` is pressed
- [ ] invokes `onSignal` with `{ kind: 'intent_down', intent: 'thrust_backward' }` when `S` is pressed
- [ ] invokes `onSignal` with `{ kind: 'intent_down', intent: 'thrust_backward' }` when `ArrowDown` is pressed
- [ ] invokes `onSignal` with `{ kind: 'intent_down', intent: 'turn_left' }` when `A` is pressed
- [ ] invokes `onSignal` with `{ kind: 'intent_down', intent: 'turn_left' }` when `ArrowLeft` is pressed
- [ ] invokes `onSignal` with `{ kind: 'intent_down', intent: 'turn_right' }` when `D` is pressed
- [ ] invokes `onSignal` with `{ kind: 'intent_down', intent: 'turn_right' }` when `ArrowRight` is pressed
- [ ] invokes `onSignal` with `{ kind: 'intent_down', intent: 'brake' }` when `Space` is pressed

### Continuous keys — `intent_up` on release

- [ ] invokes `onSignal` with `{ kind: 'intent_up', intent: 'thrust_forward' }` when `W` is released
- [ ] invokes `onSignal` with `{ kind: 'intent_up', intent: 'thrust_forward' }` when `ArrowUp` is released
- [ ] invokes `onSignal` with `{ kind: 'intent_up', intent: 'thrust_backward' }` when `S` is released
- [ ] invokes `onSignal` with `{ kind: 'intent_up', intent: 'thrust_backward' }` when `ArrowDown` is released
- [ ] invokes `onSignal` with `{ kind: 'intent_up', intent: 'turn_left' }` when `A` is released
- [ ] invokes `onSignal` with `{ kind: 'intent_up', intent: 'turn_left' }` when `ArrowLeft` is released
- [ ] invokes `onSignal` with `{ kind: 'intent_up', intent: 'turn_right' }` when `D` is released
- [ ] invokes `onSignal` with `{ kind: 'intent_up', intent: 'turn_right' }` when `ArrowRight` is released
- [ ] invokes `onSignal` with `{ kind: 'intent_up', intent: 'brake' }` when `Space` is released

### Continuous keys — auto-repeat behavior

- [ ] invokes `onSignal` only once with `intent_down` for `W` when a keydown is followed by OS auto-repeat keydown events for the same key
- [ ] invokes `onSignal` with `intent_down` for `W` again after a release-then-press cycle (auto-repeat suppression is per-hold, not lifetime)

### Discrete commands — `command` on press only

- [ ] invokes `onSignal` with `{ kind: 'command', command: { kind: 'interact' } }` when `E` is pressed
- [ ] invokes `onSignal` with `{ kind: 'command', command: { kind: 'pause_toggle' } }` when `Escape` is pressed
- [ ] does not invoke `onSignal` for `E`'s keyup event
- [ ] does not invoke `onSignal` for `Escape`'s keyup event
- [ ] invokes `onSignal` only once with `interact` when `E` keydown is followed by OS auto-repeat keydown events
- [ ] invokes `onSignal` only once with `pause_toggle` when `Escape` keydown is followed by OS auto-repeat keydown events
- [ ] invokes `onSignal` with `interact` again after `E` is released and re-pressed

### Unmapped keys

- [ ] does not invoke `onSignal` when an unmapped key (e.g. `Q`, `Shift`, `Tab`) is pressed or released

Count: 29 bullets.

---

## File: `src/core/scene/sceneMachine.test.ts`

Targets the **state-machine port** in `core/scene/`. Pure — no React, no DOM, no timers. The machine is XState v5 internally; these bullets describe transitions in domain terms (the `kind` → XState `type` translation is implementation detail and not under test here).

### Initial state and `loading` exit

- [ ] starts in `{ kind: 'loading' }`
- [ ] transitions from `loading` to `playing` on `start`
- [ ] stays in `loading` on `pause_toggle`
- [ ] stays in `loading` on `interact`
- [ ] stays in `loading` on `entered_proximity { objectId }`
- [ ] stays in `loading` on `exited_proximity { objectId }`

### Proximity transitions

- [ ] transitions from `playing` to `revealing { objectId }` on `entered_proximity` carrying that id
- [ ] transitions from `revealing { objectId }` to `playing` on `exited_proximity` carrying the same id
- [ ] stays in `revealing { objectId }` on `exited_proximity` carrying a different id

### Pause / resume round-trips

- [ ] transitions from `playing` to `paused { resumeTo: { kind: 'playing' } }` on `pause_toggle`
- [ ] transitions from `revealing { objectId }` to `paused { resumeTo: { kind: 'revealing', objectId } }` on `pause_toggle`
- [ ] transitions from `paused { resumeTo: { kind: 'playing' } }` to `playing` on `pause_toggle`
- [ ] transitions from `paused { resumeTo: { kind: 'revealing', objectId } }` to `revealing { objectId }` on `pause_toggle`
- [ ] preserves the original `objectId` across a `revealing → paused → revealing` round trip
- [ ] stays in `paused` on `entered_proximity { objectId }`
- [ ] stays in `paused` on `exited_proximity { objectId }`

Count: 16 bullets.

> **Open question — `interact` event behavior.** The amended spec lists `interact` as a machine event but does not pin its transition behavior beyond `loading` (which ignores it). Bullets for `interact` from `playing` / `revealing` / `paused` are intentionally omitted; once the spec resolves this, add the corresponding bullets in this section. See *Genuinely-new gaps* in the orchestrator-return notes. Do not invent a transition silently.

---

## File: `src/features/scene/components/Scene/Scene.test.tsx`

Targets the **Scene component port**: `SceneProps` in, `SceneEvent`s through `onEvent`. Smoke harness with R3F mocked — a host-tree-only render or `@react-three/test-renderer`. The bullets describe behavior only and remain valid regardless of harness choice.

### Mount smoke

- [ ] renders without throwing when `state = { kind: 'loading' }`, empty companies, empty intent stream
- [ ] renders without throwing when `state = { kind: 'playing' }` and a non-empty companies list
- [ ] renders without throwing when `state = { kind: 'revealing', objectId }` and the companies list contains that id
- [ ] renders without throwing when `state = { kind: 'paused', resumeTo: { kind: 'playing' } }`

### Proximity event emission

- [ ] does not invoke `onEvent` when `state = { kind: 'loading' }`
- [ ] does not invoke `onEvent` when `state = { kind: 'playing' }` and no company lies inside the player's proximity radius
- [ ] invokes `onEvent` once with `{ kind: 'entered_proximity', objectId }` on the first frame the player crosses into a company's radius
- [ ] does not invoke `onEvent` again with `entered_proximity` for the same company while the player remains inside that radius
- [ ] invokes `onEvent` once with `{ kind: 'exited_proximity', objectId }` on the first frame the player leaves that company's radius
- [ ] invokes `onEvent` with a fresh `entered_proximity` the next time the player re-enters the same radius after having exited
- [ ] emits proximity events independently per company id (one company's transitions never suppress another's)

### State-driven suppression

- [ ] does not invoke `onEvent` with any proximity event while `state = { kind: 'paused', resumeTo: ... }`
- [ ] does not invoke `onEvent` with `entered_proximity` for a company id that matches the current `revealing { objectId }`

### Port purity

- [ ] does not invoke `onEvent` with any `SceneEvent` whose `kind` is anything other than `entered_proximity` or `exited_proximity`
- [ ] does not mutate the `companies` array (length and element identities preserved across the lifetime of the test)
- [ ] does not mutate the `IntentStream` object identity (the reference handed in is the reference held; Scene does not write to `intents.current`)

Count: 16 bullets.

> **Harness note (implementer's choice, not part of the contract).** A renderer-free harness is recommended (drive frame ticks via a manual seam so proximity transitions can be observed deterministically). Whatever the chosen harness, the bullets above are the contract. If implementing a frame-tick seam requires expanding the port, surface it back — do not widen silently.

---

## File: `src/routes/index.test.tsx` *(optional smoke)*

Targets the **route boundary**: URL `/` in, mounted-widget tree out. One bullet only — deeper Scene behavior is covered by `Scene.test.tsx`.

- [ ] renders the Scene widget when the user navigates to `/`

Count: 1 bullet.

> The Foundations scope lists a `pnpm dev` console-log demo as definition-of-done. That is a manual smoke check, not an automated test. The bullet above replaces *the route-level wiring guarantee* with one machine-checkable assertion; it does not simulate end-to-end input + log inspection (which would require a real browser harness and is out of foundations scope).

---

## Static-invariant tests (CompanyId branding)

These are not behavioral tests. They are static greps over `src/` that protect the `CompanyId` minting invariant from the spec ("`asCompanyId` appears in exactly one source location; `as CompanyId` cast appears nowhere else"). They can live as plain vitest bullets that read the filesystem, or as a custom oxlint rule. The implementer chooses where they live; the count below assumes vitest bullets co-located with the type file (e.g. `src/features/scene/types/company.test.ts`).

- [ ] finds exactly one source file in `src/` defining `asCompanyId`, located at `src/features/scene/types/company.ts`
- [ ] finds exactly one occurrence of the literal `as CompanyId` in `src/`, located inside `asCompanyId` in `src/features/scene/types/company.ts`

Count: 2 bullets.

> If the rules-guardian agent prefers to express these as a lint rule rather than a vitest file, drop the bullets and add the lint rule. The invariant is what matters; the enforcement layer is implementation choice.

---

## Summary by file

| File                                                                  | Bullets |
| --------------------------------------------------------------------- | ------: |
| `src/features/scene/services/renderer/integrateMotion.test.ts`        |      17 |
| `src/features/scene/services/renderer/proximityCheck.test.ts`         |      12 |
| `src/features/scene/services/renderer/clampToBounds.test.ts`          |      10 |
| `src/features/scene/services/input/subscribeToKeyboard.test.ts`       |      29 |
| `src/core/scene/sceneMachine.test.ts`                                 |      16 |
| `src/features/scene/components/Scene/Scene.test.tsx`                  |      16 |
| `src/routes/index.test.tsx` *(optional)*                              |       1 |
| `src/features/scene/types/company.test.ts` (static invariants)        |       2 |
| **Total**                                                             | **103** |

No dedicated test file for `SceneWidget.tsx` — it is a thin glue shell per the design spec's folder-shape rules (mount canvas, hand `{ state, actions }` to `Scene`). Per the BDD agent contract, widget shells "usually [have] no dedicated tests"; the wiring is covered transitively by `Scene.test.tsx` (port-in / events-out) and `sceneMachine.test.ts` (state transitions). The `onEvent` stability requirement is asserted from the Scene side (the consumer of stability). If `SceneWidget.tsx` accumulates real logic, that is a sign the composition root has leaked — flag back, do not paper over with a test.

No dedicated test file for `useScene.ts` — its observable behavior is the composition of `subscribeToKeyboard` (covered), the machine (covered), and the Scene (covered). The translation `kind → type` at `actor.send` is mechanical and re-asserted only if it grows non-trivial.

---

## Self-check (against the BDD agent contract)

1. Could every bullet be implemented behind a different renderer / state-machine library / DOM adapter, and would each `it(...)` description still read correctly? **Yes.** The keyboard bullets do reference `keydown` / `keyup` — that is the browser's port, not an implementation choice. The machine bullets describe transitions in domain `kind` terms; the XState `type` translation is internal.
2. Does any bullet reference a hook name, ref name, internal function name, or state-variable name? **No.** Spot-checked.
3. Does any bullet's assertion merely restate the type system (e.g. "rejects an Intent without a kind")? **No.** Every bullet asserts behavior under inputs. The two static-invariant bullets enforce a grep-level architectural rule, not the type system itself.
4. Does any test file's bullets reach across into a sibling sub-layer's internals? **No.** `Scene.test.tsx` does not call the machine; `sceneMachine.test.ts` does not render; the math files take plain records and know nothing about Scene or intents-as-React.
5. Is anything paved-over with a "for now" / "stub" / "minimal" / "first step" / "workaround"? **No.** The unresolved `interact` machine-event behavior is surfaced as an *open question* with the bullets intentionally omitted — not invented and not buried.
