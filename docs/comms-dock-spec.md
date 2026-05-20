# Comms Dock — BDD/TDD Spec

Status: spec only. No implementation.
Feature path: `src/features/comms/`.
Surface: `widget/dock/` (the cockpit-HUD comms dock).

The dock is the resume's primary contact surface. It is fixed to the bottom of the viewport and remains visible across every active scene state (`playing | revealing | paused`). The visual concept (chamfer, cyan accent, scanlines) is intentionally **out of scope** for these tests — tests describe behavior through ports, never pixels.

---

## 1. User Flow Narrative

A visitor enters the interactive-resume scene and pilots a ship through a star field. Anchored to the bottom of the cockpit HUD, a comms dock is always present: on the left a velocity readout shows current speed in M/S with a proportional speed bar; on the right four channel buttons expose the resume's contact surface — LinkedIn and GitHub as link channels, Discord and Gmail as copy channels.

Activating a link channel opens that destination in a new tab with `rel="noreferrer"`. Activating a copy channel writes its value to the clipboard, the channel's LED briefly shows a success state and announces "copied" to assistive tech, then returns to idle on its own; if the clipboard call fails, the channel shows a failed state and returns to idle on the same cadence. Keyboard users get the same behavior via Enter or Space, with a visible focus ring; users with reduced motion see state transitions without animation.

---

## 2. Gherkin Scenarios

Scenarios target **ports**, not implementations. Where a scenario says "the dock", read it as "the comms-dock widget's observable surface — props going into `CommsDock`, events coming out of it, the parsed channel/readout/feedback values crossing the widget port."

### 2.1 Activate a link channel

```gherkin
Scenario: Activating a link channel emits an open-external event
  Given a link channel with id "linkedin" and href "https://www.linkedin.com/in/golansofer/"
  When the channel is activated
  Then an open-external event is emitted with kind "open_external" and href "https://www.linkedin.com/in/golansofer/"
  And no clipboard call is made
  And the channel's feedback remains kind "idle"

Scenario: The link channel opens in a new tab without referrer
  Given a link channel with id "github" and href "https://github.com/golansoffer"
  When the channel is activated via mouse
  Then the activation handler is called with target "_blank"
  And the activation handler is called with rel containing "noreferrer"
```

### 2.2 Activate a copy channel — success

```gherkin
Scenario: Activating a copy channel calls the clipboard port and shows success
  Given a copy channel with id "discord" and value "golan618"
  And the clipboard port resolves to kind "ok"
  When the channel is activated
  Then the clipboard port is called once with value "golan618"
  And the dock's feedback becomes kind "success" with channelId "discord"
  And the assistive-tech live region announces a copied message naming "Discord"

Scenario: Success feedback auto-clears after its timeout
  Given the dock feedback is kind "success" with channelId "gmail"
  When the success-clear timeout elapses
  Then the dock's feedback becomes kind "idle"
```

### 2.3 Copy channel — clipboard failure

```gherkin
Scenario: Clipboard rejection surfaces as failed feedback
  Given a copy channel with id "gmail" and value "Gsoffer550@gmail.com"
  And the clipboard port resolves to kind "failed"
  When the channel is activated
  Then the dock's feedback becomes kind "failed" with channelId "gmail"
  And the assistive-tech live region announces a copy-failed message naming "Gmail"

Scenario: Failed feedback auto-clears after its timeout
  Given the dock feedback is kind "failed" with channelId "discord"
  When the failed-clear timeout elapses
  Then the dock's feedback becomes kind "idle"
```

### 2.4 Re-activating during success restarts the timer

```gherkin
Scenario: Re-activating a copy channel mid-success restarts the success window
  Given the dock feedback is kind "success" with channelId "discord"
  And the success-clear timeout has not yet elapsed
  When the same copy channel is activated again
  Then the clipboard port is called a second time with the channel's value
  And the dock's feedback remains kind "success" with channelId "discord"
  And the success-clear timeout is restarted from now

Scenario: Activating a different copy channel during success replaces the active feedback
  Given the dock feedback is kind "success" with channelId "discord"
  When a copy channel with id "gmail" is activated
  And its clipboard call resolves to kind "ok"
  Then the dock's feedback becomes kind "success" with channelId "gmail"
  And the success-clear timeout for "gmail" is the only one pending
```

### 2.5 Velocity readout projection

```gherkin
Scenario: Stationary ship projects a zero readout
  Given a kinematics sample with velocity magnitude 0
  When the readout projection runs
  Then it returns kind "readout" with metersPerSecond 0 and ratio 0

Scenario: Top-speed ship projects max readout and ratio 1
  Given a max speed of 14
  And a kinematics sample with velocity magnitude 14
  When the readout projection runs
  Then it returns kind "readout" with metersPerSecond 14 and ratio 1

Scenario: Mid-range speed projects a proportional ratio
  Given a max speed of 14
  And a kinematics sample with velocity magnitude 7
  When the readout projection runs
  Then it returns kind "readout" with metersPerSecond 7 and ratio 0.5

Scenario: Velocity above the max clamps to ratio 1
  Given a max speed of 14
  And a kinematics sample with velocity magnitude 20
  When the readout projection runs
  Then it returns kind "readout" with ratio 1

Scenario: Readout reflects the latest sample crossing the kinematics port
  Given the kinematics port is subscribed
  And the dock has rendered an initial readout
  When the kinematics port pushes a new sample with velocity magnitude 7 and max speed 14
  Then the readout passed to the dock component becomes kind "readout" with metersPerSecond 7 and ratio 0.5
```

### 2.6 Dock visibility across scene states

```gherkin
Scenario Outline: The dock is visible during every active scene state
  Given the scene state is kind "<sceneKind>"
  When the dock visibility is evaluated
  Then the dock is rendered visible

  Examples:
    | sceneKind  |
    | playing    |
    | revealing  |
    | paused     |

Scenario: The dock is not rendered before the scene has loaded
  Given the scene state is kind "loading"
  When the dock visibility is evaluated
  Then the dock is not rendered
```

### 2.7 Keyboard activation

```gherkin
Scenario Outline: Enter and Space activate a focused channel
  Given the focus is on a channel button with id "<channelId>"
  When the user presses "<key>"
  Then the same activation event is emitted as on click for "<channelId>"

  Examples:
    | channelId | key   |
    | linkedin  | Enter |
    | linkedin  | Space |
    | discord   | Enter |
    | discord   | Space |

Scenario: Non-activating keys do not activate a focused channel
  Given the focus is on a channel button with id "github"
  When the user presses "Tab"
  Then no activation event is emitted
```

### 2.8 Focus

```gherkin
Scenario: Keyboard focus renders a visible focus indicator
  Given the dock is rendered
  When a channel button receives keyboard focus
  Then the focused channel button matches the focus-visible state

Scenario: Pointer focus does not render the keyboard focus indicator
  Given the dock is rendered
  When a channel button is focused via pointer
  Then the channel button does not match the focus-visible state
```

### 2.9 Reduced motion

```gherkin
Scenario: Reduced-motion mode renders state changes without animation
  Given the user prefers reduced motion
  When the dock feedback transitions from kind "idle" to kind "success"
  Then the success indicator is rendered in its final state without an animated transition

Scenario: Reduced-motion mode is reflected in props crossing the component port
  Given the user prefers reduced motion
  When the dock renders
  Then the motion preference passed to CommsDock is kind "reduced"
```

### 2.10 Accessibility

```gherkin
Scenario Outline: Every channel button has an accessible name
  Given the dock is rendered with the standard channel set
  When assistive tech queries each channel button
  Then each button has an accessible name including "<label>"

  Examples:
    | label    |
    | LinkedIn |
    | GitHub   |
    | Discord  |
    | Gmail    |

Scenario: Copy success is announced politely
  Given a copy channel with id "gmail"
  And the clipboard port resolves to kind "ok"
  When the channel is activated
  Then an aria-live "polite" region contains a message naming "Gmail"

Scenario: Copy failure is announced politely
  Given a copy channel with id "discord"
  And the clipboard port resolves to kind "failed"
  When the channel is activated
  Then an aria-live "polite" region contains a copy-failed message naming "Discord"
```

---

## 3. TDD Test Bullets — organized by file

Each bullet describes **observable behavior** through that file's port. No bullet inspects internals, hooks, or DOM beyond the port.

### 3.1 `features/comms/types/channel.test.ts` — parsing + projection (pure)

Domain port: raw inputs → parsed discriminated unions. No React, no DOM, no clipboard.

`parseChannel`
- [ ] parses a link channel descriptor into kind "link" with id, label, and href
- [ ] parses a copy channel descriptor into kind "copy" with id, label, and value
- [ ] rejects a descriptor missing href on a link channel
- [ ] rejects a descriptor missing value on a copy channel
- [ ] rejects a descriptor whose kind is neither "link" nor "copy"
- [ ] rejects a link channel whose href is not an http(s) URL

`projectVelocityReadout`
- [ ] returns kind "readout" with metersPerSecond 0 and ratio 0 when velocity magnitude is 0
- [ ] returns kind "readout" with metersPerSecond equal to max and ratio 1 at top speed
- [ ] returns ratio 0.5 when velocity magnitude is half of max speed
- [ ] clamps ratio to 1 when velocity magnitude exceeds max speed
- [ ] returns metersPerSecond equal to the input magnitude, not its components
- [ ] derives ratio independently of vector direction (same magnitude → same readout)

`feedbackReducer` (pure `(state, event) → state`)
- [ ] transitions from kind "idle" to kind "success" with channelId on a copy_succeeded event
- [ ] transitions from kind "idle" to kind "failed" with channelId on a copy_failed event
- [ ] transitions from kind "success" back to kind "idle" on a clear event
- [ ] transitions from kind "failed" back to kind "idle" on a clear event
- [ ] replaces the active channelId when a second copy_succeeded event arrives for a different channel
- [ ] re-enters kind "success" with the same channelId on a repeat copy_succeeded event (restart semantics observable as a new state object)

### 3.2 `features/comms/services/clipboard.test.ts` — clipboard adapter (success/failed branches)

Service port: `copyToClipboard(value: string): Promise<{ kind: 'ok' } | { kind: 'failed' }>`. Tested against a fake clipboard injected at the port boundary.

- [ ] resolves to kind "ok" when the underlying write resolves
- [ ] resolves to kind "failed" when the underlying write rejects
- [ ] resolves to kind "failed" when no clipboard capability is available
- [ ] passes the exact input string to the underlying write
- [ ] does not throw on rejection — failures always surface as a kind "failed" result
- [ ] returns a fresh result per call (no shared state between calls)

### 3.3 `features/comms/components/CommsDock/CommsDock.test.tsx` — pure UI (props in / events out)

Component port: props are parsed channels + parsed readout + parsed feedback + parsed motion preference; events flow out as discriminated-union messages. The test never reaches into hooks, the clipboard, or scene state.

Rendering
- [ ] renders one channel button per channel passed in
- [ ] renders each channel button with an accessible name including its label
- [ ] renders the velocity readout's metersPerSecond as displayed text
- [ ] renders the velocity readout's ratio as the speed bar's reported fill (port: `aria-valuenow` or equivalent observable attribute)
- [ ] renders the success indicator on the channel matching feedback.channelId when feedback kind is "success"
- [ ] renders the failed indicator on the channel matching feedback.channelId when feedback kind is "failed"
- [ ] renders no per-channel indicator when feedback kind is "idle"

Events out
- [ ] emits onActivate with the channel's id when a link channel button is clicked
- [ ] emits onActivate with the channel's id when a copy channel button is clicked
- [ ] emits onActivate with the channel's id when Enter is pressed on a focused channel button
- [ ] emits onActivate with the channel's id when Space is pressed on a focused channel button
- [ ] does not emit onActivate on keys other than Enter or Space
- [ ] emits exactly one onActivate per activation (no duplicates on keyboard activation)

Accessibility surface
- [ ] exposes an aria-live "polite" region for copy feedback announcements
- [ ] includes the channel's label in the announcement when feedback is kind "success"
- [ ] includes the channel's label in the announcement when feedback is kind "failed"
- [ ] removes the announcement text when feedback returns to kind "idle"

Motion preference
- [ ] passes through motion preference kind "normal" without altering rendered state
- [ ] renders feedback indicators in their final state without animation when motion preference is kind "reduced"

### 3.4 `features/comms/widget/dock/useCommsDock.test.ts` — wiring (state machine + clipboard port + kinematics port)

Widget port: feed parsed channels, a fake clipboard port, a controllable kinematics subscription, and a controllable timer; assert the `{ state, actions }` returned. No JSX inspected.

Activation routing
- [ ] activating a link channel returns an actions.openExternal call with the channel's href and rel containing "noreferrer"
- [ ] activating a link channel does not call the clipboard port
- [ ] activating a copy channel calls the clipboard port once with the channel's value
- [ ] activating a copy channel does not call openExternal

Copy success path
- [ ] after a clipboard resolution kind "ok", state.feedback becomes kind "success" with the activated channelId
- [ ] state.feedback returns to kind "idle" after the success-clear timer elapses
- [ ] re-activating the same copy channel while feedback is kind "success" leaves state.feedback as kind "success" with the same channelId
- [ ] re-activating the same copy channel while feedback is kind "success" restarts the success-clear timer (the prior pending timer no longer fires a clear)
- [ ] activating a different copy channel while feedback is kind "success" transitions state.feedback to kind "success" with the new channelId once its clipboard call resolves

Copy failure path
- [ ] after a clipboard resolution kind "failed", state.feedback becomes kind "failed" with the activated channelId
- [ ] state.feedback returns to kind "idle" after the failed-clear timer elapses
- [ ] a clipboard rejection never throws out of the activation actions call

Velocity readout wiring
- [ ] state.readout reflects the latest kinematics sample as kind "readout" with metersPerSecond and ratio
- [ ] state.readout updates when the kinematics port pushes a new sample
- [ ] state.readout exposes ratio 0 when the subscribed sample has velocity magnitude 0
- [ ] state.readout exposes ratio 1 when the subscribed sample has velocity magnitude at max speed
- [ ] state.readout never exposes raw `Kinematics` (port carries only parsed `Readout`)

Visibility wiring
- [ ] state.visibility is kind "visible" when the scene state is kind "playing"
- [ ] state.visibility is kind "visible" when the scene state is kind "revealing"
- [ ] state.visibility is kind "visible" when the scene state is kind "paused"
- [ ] state.visibility is kind "hidden" when the scene state is kind "loading"

Concurrency / lifecycle
- [ ] rapid repeat activations of one copy channel produce a single pending success-clear timer at any moment
- [ ] unsubscribing the hook stops further kinematics samples from updating state.readout
- [ ] unsubscribing the hook cancels any pending success-clear or failed-clear timer (no late clear after teardown)

---

## 4. Coverage Checklist

- [x] Acceptance — link activation emits open-external with href + `rel="noreferrer"` (2.1, 3.3, 3.4)
- [x] Acceptance — copy activation calls clipboard port and shows success (2.2, 3.3, 3.4)
- [x] Failure path — clipboard rejection shows failed feedback (2.3, 3.2, 3.4)
- [x] Failure path — clipboard unavailable resolves kind "failed" (3.2)
- [x] Async — success feedback auto-clears (2.2, 3.4)
- [x] Async — failed feedback auto-clears (2.3, 3.4)
- [x] Async — re-activation during success restarts timer (2.4, 3.4)
- [x] Async — distinct channel during success replaces active feedback (2.4, 3.4)
- [x] Velocity — zero state (2.5, 3.1, 3.4)
- [x] Velocity — max state (2.5, 3.1, 3.4)
- [x] Velocity — mid-range proportionality (2.5, 3.1, 3.4)
- [x] Velocity — clamp above max (2.5, 3.1)
- [x] Velocity — port carries parsed `Readout`, never raw `Kinematics` (3.4)
- [x] Visibility — visible across `playing | revealing | paused` (2.6, 3.4)
- [x] Visibility — hidden during `loading` (2.6, 3.4)
- [x] A11y — every channel has accessible name (2.10, 3.3)
- [x] A11y — success announced via aria-live polite (2.10, 3.3)
- [x] A11y — failure announced via aria-live polite (2.10, 3.3)
- [x] Keyboard — Enter activates (2.7, 3.3)
- [x] Keyboard — Space activates (2.7, 3.3)
- [x] Keyboard — non-activating keys ignored (2.7, 3.3)
- [x] Focus — focus-visible for keyboard, not pointer (2.8)
- [x] Motion — reduced-motion renders final state without animation (2.9, 3.3)
- [x] Concurrency — rapid repeat activations collapse to one pending timer (3.4)
- [x] Lifecycle — teardown cancels pending timers and unsubscribes kinematics (3.4)

---

## 5. Self-Check

1. Could the implementation be rewritten in Solid + a different clipboard library + a different kinematics source and every test still make sense?
   - `types/channel.test.ts` — pure functions; framework-free. Pass.
   - `services/clipboard.test.ts` — asserts the port's discriminated-union result; the underlying clipboard impl is injected. Pass.
   - `components/CommsDock.test.tsx` — props in / events out / accessible name / `aria-live` region / observable focus-visible state. No hook or DOM-internal assertions. Pass.
   - `widget/dock/useCommsDock.test.ts` — feeds a fake clipboard port, a controllable kinematics subscription, and a controllable timer; asserts `{ state, actions }`. Pass.

2. Does any scenario name an internal function, hook, store, or framework primitive? No. References are to ports: `clipboard port`, `kinematics port`, `state.feedback`, `state.readout`, `state.visibility`, `actions.openExternal`, `onActivate`, `aria-live polite`.

3. Is every assertion load-bearing?
   - No bullet restates the type system (e.g., "rejects a non-string href" — left to the parser type itself; the parser tests assert structural acceptance/rejection by **kind**, not by stringifying TypeScript's job).
   - No bullet tests pixels, CSS classes, or visual structure — only observable accessibility/port attributes.

4. Symptoms checked:
   - Optional-flag explosion? No — `feedback` is a 3-variant union (`idle | success | failed`), `visibility` is `visible | hidden`, `readout` is a single `kind: 'readout'` variant. No boolean toggle smuggled in.
   - Sibling-adapter leakage? No — components never see the clipboard or kinematics; the widget never sees JSX; the parser never sees React.
   - Legacy-pending behavior? None.

The spec stands.
