# 3D Foundations — TDD Test Bullets

**Date:** 2026-05-19
**Status:** Test bullets for the foundations build defined in [2026-05-19-3d-renderer-design.md § Foundations scope](./2026-05-19-3d-renderer-design.md#foundations-scope-next-session).
**Companion:** [2026-05-19-3d-foundations-bdd.md](./2026-05-19-3d-foundations-bdd.md)

---

## Reading rules

- Each bullet is one `it(...)` description — plain English, action-verb led.
- Bullets describe **observable output** crossing the port under test. No bullet names a hook, ref, reconciler, renderer engine, or DOM node type. The harness used to execute the test is implementation choice; the bullet wording does not change if it swaps.
- Each file's tests target one port and one port only — they never reach across into a sibling sub-layer's internals. (Example: `Scene.test.tsx` does not call into the reducer; `sceneMachine.test.ts` does not render anything.)
- Files are grouped by the layer-port they target. The bullet count per file is documented inline so future agents can verify nothing leaked or accumulated.

---

## File: `src/features/scene/services/renderer/integrateMotion.test.ts`

Targets the **pure kinematic integration port**. Inputs and outputs are plain records — no engine types. No React, no DOM.

- [ ] returns the same position when called with no intents and a zero velocity
- [ ] returns the same velocity when called with no intents (preserves momentum)
- [ ] advances position along the current velocity direction proportional to `dt`
- [ ] increases velocity along the heading axis when the active intent set includes a forward thrust
- [ ] decreases velocity along the forward direction when the active intent set includes a backward thrust
- [ ] decreases speed magnitude when the active intent set includes brake and velocity is non-zero
- [ ] does not change a zero velocity when the active intent set includes brake (brake from rest is a no-op)
- [ ] does not flip the velocity sign on a single brake frame (no overshoot through zero)
- [ ] rotates the heading counter-clockwise around the up axis when the active intent set includes a left turn
- [ ] rotates the heading clockwise around the up axis when the active intent set includes a right turn
- [ ] scales the rotation magnitude proportionally to `dt`
- [ ] scales the position delta proportionally to `dt` (motion is smooth, not teleport)
- [ ] applies both thrust and turn simultaneously when both intents are active in the same frame
- [ ] returns deeply unchanged input objects (no mutation of position, velocity, or intents)
- [ ] returns the same output for the same inputs across repeated calls (pure / referentially transparent)

Count: 15 bullets.

---

## File: `src/features/scene/services/renderer/proximityCheck.test.ts`

Targets the **pure proximity query port**. Plain-record signatures only.

- [ ] returns an empty set when the companies list is empty
- [ ] returns an empty set when no company lies within radius
- [ ] returns a set containing exactly the id of a company inside the radius
- [ ] excludes a company strictly outside the radius
- [ ] includes a company exactly on the radius boundary (closed-disk semantics)
- [ ] computes Euclidean distance across all three axes (a company at `(3,4,0)` is exactly on a radius-5 boundary)
- [ ] excludes a company whose 3D distance exceeds the radius even when its 2D projection lies inside
- [ ] returns every in-range company id when multiple are in range (independence across companies)
- [ ] returns the ids of in-range companies and omits out-of-range companies in a mixed list
- [ ] returns deeply unchanged input objects (no mutation of player position or companies array)
- [ ] returns a new set instance on each call (does not return a cached/mutated singleton)

Count: 11 bullets.

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

## File: `src/features/scene/services/input/keyboard.test.ts`

Targets the **keyboard adapter port**: external key events in, `IntentStream.current: ReadonlySet<Intent['kind']>` out. This is the inbound boundary of the input adapter — the harness dispatches `keydown` / `keyup` (the external system); the bullets assert the parsed port output.

- [ ] starts with an empty `intents.current` when attached and no keys have been pressed
- [ ] adds `thrust` to `intents.current` when W is pressed and held
- [ ] adds `thrust` to `intents.current` when ArrowUp is pressed and held
- [ ] adds `thrust` to `intents.current` when S is pressed and held
- [ ] adds `thrust` to `intents.current` when ArrowDown is pressed and held
- [ ] adds `turn` to `intents.current` when A is pressed and held
- [ ] adds `turn` to `intents.current` when ArrowLeft is pressed and held
- [ ] adds `turn` to `intents.current` when D is pressed and held
- [ ] adds `turn` to `intents.current` when ArrowRight is pressed and held
- [ ] removes `thrust` from `intents.current` when the only held thrust key is released
- [ ] removes `turn` from `intents.current` when the only held turn key is released
- [ ] keeps `thrust` in `intents.current` when W is released but ArrowUp remains held
- [ ] reports `thrust` and `turn` together in `intents.current` when W and A are held simultaneously
- [ ] reports a single `thrust` entry (not two) when W and ArrowUp are both held
- [ ] ignores keys outside the mapped set (e.g. `Q`, `Shift`, `Tab`)
- [ ] returns to the empty set after a press immediately followed by a release of the same key
- [ ] exposes the same `intents` object identity across reads (consumers may pull without re-subscribing)

Count: 17 bullets.

---

## File: `src/features/scene/widget/scene/sceneMachine.test.ts`

Targets the **state-machine port**: `(state, event) → state` over `SceneState` and `SceneEvent`. Pure. No React, no DOM, no timers. The bullets do not call any actor / interpreter API by name; they assert *given a state, processing an event yields the expected next state*.

> See "Pause-trigger decision" in *Spec gaps* below — these bullets follow the `interact_pressed` path.

- [ ] starts in `{ kind: 'loading' }`
- [ ] transitions from `loading` to `playing` on the `mount` transition
- [ ] transitions from `playing` to `revealing { objectId }` on `entered_proximity` carrying that id
- [ ] transitions from `revealing { objectId }` to `playing` on `exited_proximity` carrying the same id
- [ ] stays in `revealing { objectId }` when `exited_proximity` carries a different id
- [ ] transitions from `playing` to `paused` on `interact_pressed`
- [ ] transitions from `revealing { objectId }` to `paused` on `interact_pressed`
- [ ] transitions from `paused` to `playing` on `interact_pressed` (toggle path)
- [ ] stays in `paused` on `entered_proximity`
- [ ] stays in `paused` on `exited_proximity`
- [ ] stays in `loading` on `entered_proximity`, `exited_proximity`, and `interact_pressed`
- [ ] preserves the `objectId` discriminator field across `revealing` self-events (no field mutation)

Count: 12 bullets.

---

## File: `src/features/scene/components/Scene/Scene.test.tsx`

Targets the **Scene component port**: `SceneProps` in, `SceneEvent`s through `onEvent`. Smoke harness without WebGL — the implementer chooses the renderer-free / headless approach (a `@react-three/test-renderer`-style harness, a stubbed canvas, or a host-tree-only render). The bullets describe behavior only and remain valid regardless of harness.

- [ ] renders without throwing when `state = { kind: 'loading' }`, empty companies, empty intent stream
- [ ] renders without throwing when `state = { kind: 'playing' }` and a non-empty companies list
- [ ] does not call `onEvent` when `state = { kind: 'loading' }`
- [ ] calls `onEvent` once with `{ kind: 'entered_proximity', objectId }` on the first frame the player crosses into a company's radius
- [ ] does not call `onEvent` again with `entered_proximity` while the player remains continuously inside the radius of the same company
- [ ] calls `onEvent` once with `{ kind: 'exited_proximity', objectId }` on the first frame the player leaves the radius after entering it
- [ ] calls `onEvent` with a fresh `entered_proximity` the next time the player re-enters the same radius after having exited
- [ ] emits proximity events independently per company id (one company's transitions never suppress another's)
- [ ] calls `onEvent` once with `{ kind: 'interact_pressed' }` on the frame `interact` newly appears in `intents.current`
- [ ] does not call `onEvent` again with `interact_pressed` while `interact` remains continuously in `intents.current`
- [ ] does not emit any proximity event while `state = { kind: 'paused' }`
- [ ] does not emit `entered_proximity` for a company id that matches the current `revealing { objectId }`
- [ ] does not mutate the `companies` array (length and element identities preserved)
- [ ] does not mutate the `intents` object (identity preserved; the set is not written to from inside Scene)

Count: 14 bullets.

> **Harness note (implementer's choice, not part of the contract).** A renderer-free harness is recommended (e.g. drive frame ticks manually and expose a seam for "advance one frame" so proximity transitions can be observed deterministically). Whatever the chosen harness, the bullets above are the contract. If implementing a frame-tick seam requires expanding the port, surface it back instead of widening silently.

---

## File: `src/routes/index.test.tsx` *(optional — see Spec gaps)*

Targets the **route boundary**: URL `/` in, mounted widget tree out. A single happy-path bullet keeps the route under test without leaking into Scene internals (those are covered by `Scene.test.tsx`).

- [ ] renders the Scene widget when the user navigates to `/`

Count: 1 bullet.

> **Optional.** The Foundations scope lists a `pnpm dev` console-log demo as definition-of-done. That is a manual smoke check, not an automated test. The bullet above replaces *the route-level wiring guarantee* with one machine-checkable assertion; it does not attempt to simulate end-to-end input + log inspection (which would require a real browser harness and is out of foundations scope). Drop the file if the route-url-adapter agent prefers to cover this via a separate dedicated route test fixture instead.

---

## Summary by file

| File                                                                             | Bullets |
| -------------------------------------------------------------------------------- | ------: |
| `services/renderer/integrateMotion.test.ts`                                      |      15 |
| `services/renderer/proximityCheck.test.ts`                                       |      11 |
| `services/renderer/clampToBounds.test.ts`                                        |      10 |
| `services/input/keyboard.test.ts`                                                |      17 |
| `widget/scene/sceneMachine.test.ts`                                              |      12 |
| `components/Scene/Scene.test.tsx`                                                |      14 |
| `routes/index.test.tsx` *(optional)*                                             |       1 |
| **Total**                                                                        |  **80** |

No dedicated test file for `SceneWidget.tsx` — it is a thin glue shell per the design spec's folder-shape rules (mount canvas, hand `{ state, actions }` to `Scene`). Per the BDD agent contract, widget shells "usually [have] no dedicated tests"; the wiring is covered transitively by `Scene.test.tsx` (port-in / events-out) and `sceneMachine.test.ts` (state transitions). If `SceneWidget.tsx` accumulates real logic, that is a sign the composition root has leaked — flag back, do not paper over with a test.

---

## Spec gaps to resolve before implementation agents code

These are concrete contradictions or under-specified surfaces I noticed in the design spec. They are not blockers for the BDD/TDD layer (every scenario above is well-defined), but the implementer will hit them on day one. Resolve before launching the first builder agent.

### Gap A — `Intent['kind']` Set loses the `axis` / `direction` discriminator

The design spec's port shape:

```typescript
type Intent =
  | { readonly kind: 'thrust'; readonly axis: 'forward' | 'backward' }
  | { readonly kind: 'turn'; readonly direction: 'left' | 'right' }
  | { readonly kind: 'brake' }
  | { readonly kind: 'interact' };

type IntentStream = { readonly current: ReadonlySet<Intent['kind']> };
```

`ReadonlySet<Intent['kind']>` is `ReadonlySet<'thrust' | 'turn' | 'brake' | 'interact'>` — *the discriminator only*. Holding W (thrust forward) and S (thrust backward) collapses to a single `'thrust'` entry; the `axis` is unrecoverable from the Set. Same for `'turn'` and the `direction` field.

But `integrateMotion` must distinguish forward-vs-backward and left-vs-right to do anything kinematic. The math service cannot work from `Set<Intent['kind']>` alone.

**Resolution options (you pick):**

1. Tighten the port: `IntentStream.current: ReadonlySet<Intent>` (full discriminated union, not just kind). Multi-key opposing directions become two distinct set members.
2. Replace the set-of-kinds with per-axis flags: `{ thrust: 'forward' | 'backward' | null; turn: 'left' | 'right' | null; brake: boolean; interact: boolean }`. Cleaner for the math, but a wider port.
3. Keep the set-of-kinds at the widget-public port and have a richer internal representation flow into `integrateMotion`. The keyboard adapter becomes the source of the richer representation; the public `IntentStream` is a projection. (Adds a layer, but keeps the public port narrow.)

I wrote the scenarios faithful to option 1's intent (the math distinguishes axes; the keyboard scenarios assert the kind-only set per the literal port). The choice changes the signature of `integrateMotion` and the keyboard adapter's output shape but not the scenarios' observable behavior — only the type details flowing through them.

### Gap B — `brake` and `interact` have no listed keybinding

The Foundations scope says "WASD or arrow keys yields the corresponding `Intent['kind']`." That covers `thrust` and `turn` cleanly (8 keys → 2 kinds). But `Intent` has four kinds. The spec doesn't say which key maps to `brake` or `interact`.

The TDD/BDD scenarios above do **not** assert a specific key for `brake` or `interact` (only the behavior once the intent is in the stream). Decide and add to the keybindings before the data-adapter-builder agent codes the keyboard adapter:

- Common defaults: Space → `brake`, Enter or E → `interact`.
- The design spec's *Out of scope* explicitly lists "no remap config" — so this is a fixed mapping for now.

### Gap C — `paused` toggle trigger

The Foundations scope text is ambiguous: *"`paused` on a key (e.g. Escape) toggle"* vs the system prompt's mention of an `interact_pressed` event triggering pause. The BDD/TDD bullets above commit to the `interact_pressed` path because it keeps the state-machine port clean (events only). If you prefer the Escape path, the change is small but real:

- Keyboard adapter adds an Escape mapping.
- A new `SceneEvent` kind (`'paused_pressed'` or similar) appears on the port, or an existing kind is overloaded.
- The widget composition root translates the press-edge Escape key into that event.

The state-machine bullets affecting pause would need their event-kind renamed. Decide before the state-machine agent codes the transitions.

### Gap D — Press-edge vs hold semantics for `interact`

The `IntentStream` is a continuous "what is held right now" snapshot. `SceneEvent.interact_pressed` is plainly an edge-triggered event ("just pressed"). The translation from one to the other (hold-edge detection) lives somewhere — most naturally in the widget composition root or in the Scene's per-frame logic. The design spec doesn't pin it.

The BDD/TDD bullets above commit to the Scene observing the press-edge ("`interact` newly appears in `intents.current`"). That places the edge-detection inside the Scene component's frame loop, which is consistent with how proximity transitions work. If you prefer the composition root to own edge detection and emit `interact_pressed` directly into `onEvent`, the Scene contract loses the press-edge bullets and gains a port-shape note. Decide before the ui-component-builder agent codes Scene.

### Gap E — Proximity radius is not in the port

`proximityCheck` takes a `radius` argument; the design spec doesn't say where that constant lives or whether it crosses any port. It is not in `SceneProps`. Most natural answer: a module-level constant inside `components/Scene/ProximityWatcher.tsx` (or co-located). Confirm; if it should be configurable per-feature, lift it to a port. Otherwise document it as the foundations-default and move on.

### Gap F — `loading` exit trigger

The spec says "`loading → playing` on mount." Mount is not a `SceneEvent`. The bullets above treat it as a `mount` transition (an entry action / spontaneous transition on machine start), which is standard for state-machine libraries. If the intent was that `loading` is entered+exited synchronously and the machine's *initial state* is `playing`, the bullets need to be revised: drop `loading` from the machine and treat it as a pre-mount placeholder rendered by the widget shell only. Decide.

---

## Self-check (against the BDD agent contract)

1. Could every bullet be implemented behind a different renderer / state-machine library / DOM adapter, and would each `it(...)` description still read correctly? **Yes.** Re-read with that lens performed.
2. Does any bullet reference a hook name, ref name, internal function, or state-variable name? **No.** Spot-checked all 80 bullets.
3. Does any bullet's assertion merely restate the type system (e.g. "rejects an Intent without a kind")? **No.** Every bullet asserts behavior under inputs, not the shape of the union.
4. Does any test file's bullets reach across into a sibling sub-layer's internals (e.g. Scene tests calling into the reducer, reducer tests rendering)? **No.** Each file targets one port and stops at it.
5. Is anything paved-over with a "for now" / "stub" / "minimal" / "first step" / "workaround"? **No.** All scope-questions surfaced as *Spec gaps* for upstream resolution, not papered over inside the bullets.
