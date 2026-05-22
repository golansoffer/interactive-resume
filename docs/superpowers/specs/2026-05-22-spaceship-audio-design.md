# Spaceship Audio — Design

**Date:** 2026-05-22
**Scope:** Add two looping sound effects to the scene — `rocket_engine.mp3` (ambient engine, plays continuously while the scene is live) and `rocket_boost.mp3` (boost layer, fades in/out with the existing smoothed boost factor). Add a clickable mute toggle in the top-left corner with localStorage persistence. Designed so a future ambient music track is a strict additive change within the new feature.

---

## Goal

The scene currently has no audio. The user has dropped two `.mp3` files into `public/audio/`:
- `rocket_engine.mp3` — covers both idle and moving states (one continuous engine loop).
- `rocket_boost.mp3` — plays while space-bar boost is active.

Both are diegetic spaceship SFX, scene-only. The audio must:

1. Layer **additively**: engine = always on while the scene is live; boost = additional layer, gain follows the existing smoothed `boost.factor` so the cancel-on-proximity latch is honored for free.
2. Be **silent** during `loading` and `paused`, resume on un-pause.
3. Respect **browser autoplay policy**: the AudioContext stays `suspended` until the first user gesture (key press or pointer-down). No "click to enable sound" overlay.
4. Be **mutable** via a single clickable icon. No keyboard shortcut. localStorage-persisted, default unmuted.
5. Be **extensible**: a future ambient music track adds a setter and an audio node, no refactor.

## Non-goals

- No keyboard mute shortcut.
- No theme/ambient music in this spec (the file does not exist yet). Future addition is documented as a strict additive change but **not scaffolded**.
- No per-axis spatialization (no PannerNode, no positional audio). Engine + boost are 2D stereo loops.
- No engine-volume modulation by speed. The single engine file is intended to cover both idle and moving — constant gain while scene is live.
- No volume slider — mute toggle only. Per-channel master gains are constants in the service.
- No audio settings persistence beyond the mute flag.
- No reactivity to motion-reduced preference (audio ≠ motion).
- No core/ domain logic — audio is reactive plumbing over signals already shaped by core (`SceneState`, `BoostStep`).

---

## Architecture

### Layer placement

New vertical-slice feature `features/audio/`, mirroring the existing shape of `features/comms/`, `features/scene/`, `features/ships/`.

```
features/audio/
├── types/
│   └── audio-orchestrator.ts        — SpaceshipAudio port type
├── services/
│   ├── createSpaceshipAudio.ts      — Web Audio adapter; pure callback API; no React
│   └── createSpaceshipAudio.test.ts
├── components/
│   └── MuteToggle/
│       ├── MuteToggle.tsx           — pure controlled component, props in/events out
│       └── MuteToggle.test.tsx
└── widget/
    └── mute/
        ├── useMute.ts               — localStorage-backed mute state
        ├── useMute.test.ts
        └── MuteToggleWidget.tsx     — thin shell
```

Touch points outside the new feature:

```
features/scene/widget/scene/useScene.ts        — instantiates createSpaceshipAudio(); pushes sceneAlive
features/scene/widget/scene/SceneWidget.tsx    — mounts <MuteToggleWidget />; passes audio to Scene
features/scene/components/Scene/Scene.tsx      — accepts audio prop, threads to Player
features/scene/components/Scene/Player.tsx     — calls audio.setBoost in useFrame after boostController.tick
```

No `core/` addition. No new state machine. No new schema (no parsed input crosses a boundary). No new route. No URL state.

### Dependency rule

```
SceneWidget → MuteToggleWidget → MuteToggle (pure UI, lucide-react icon)
SceneWidget → useScene → createSpaceshipAudio (service)
                       → useMute (localStorage hook)
useScene → Scene → Player → audio.setBoost(…)  (per-frame)
useScene → useEffect → audio.setSceneAlive(…)  (on state.kind transition)
useMute → useEffect → audio.setMuted(…)        (on toggle)
```

All cross-feature traffic flows through declared ports (`SpaceshipAudio`, the existing `SceneState`, the existing `BoostStep`-shaped values). The audio service is unaware of React, the router, the FSM. The components are unaware of Web Audio.

### Port

```typescript
// features/audio/types/audio-orchestrator.ts

export type SpaceshipAudio = {
  readonly setSceneAlive: (alive: boolean) => void;
  readonly setBoost: (active: boolean, factor: number) => void;
  readonly setMuted: (muted: boolean) => void;
  readonly dispose: () => void;
};
```

Three orthogonal signals. Each setter is idempotent — re-pushing the same value is a no-op at the audio-graph level.

### Internal state (discriminated union, Iron Law 2)

```typescript
type AudioInternal =
  | { readonly kind: 'pre_gesture'; readonly pending: PendingSetters }
  | {
      readonly kind: 'ready';
      readonly ctx: AudioContext;
      readonly master: GainNode;
      readonly engineGain: GainNode;
      readonly boostGain: GainNode;
      readonly engineSource: AudioBufferSourceNode;
      readonly boostSource: AudioBufferSourceNode;
    }
  | { readonly kind: 'disposed' };

type PendingSetters = {
  readonly sceneAlive: boolean;
  readonly boostActive: boolean;
  readonly boostFactor: number;
  readonly muted: boolean;
};
```

This makes "playing audio before the browser has unlocked the context" structurally unrepresentable. In the `pre_gesture` state, setter calls update `pending`. On the first user gesture, the service decodes buffers, builds the node graph, transitions to `ready`, and replays `pending` into the live graph in one shot.

`disposed` is terminal — setter calls after dispose are no-ops.

---

## Behavior

### Engine loop

- Plays continuously while `sceneAlive === true && muted === false`.
- Constant target gain: `ENGINE_TARGET = 0.35`.
- On `setSceneAlive(true)`: `engineGain.gain.linearRampToValueAtTime(ENGINE_TARGET, now + 0.3)`.
- On `setSceneAlive(false)`: ramp to 0 over 300ms. Source keeps looping (a Web Audio `AudioBufferSourceNode` can only be started once — we never stop it; we only mute its gain).
- On mute toggle: handled at the master-gain layer (one place to cut everything cleanly).

### Boost loop

- Always looping. Gain target = `BOOST_MASTER * boost.factor` where `BOOST_MASTER = 0.55` and `boost.factor` is the smoothed value the upstream `boostController` already produces.
- No double-smoothing — `setBoost` writes the gain directly via `setValueAtTime`. The visual `factor` and the audio `factor` will be perceptually locked.
- `active` is part of the upstream `BoostStep` shape and is therefore part of the port signature for fidelity to the source value; gain is derived from `factor` alone since `factor` already encodes active-ness through the smoothing.

### Mute

- `muted === true`: master gain ramps to 0 over 150ms (prevents click).
- `muted === false`: master gain ramps to 1 over 150ms.
- All sub-gains stay at their natural levels — mute is a single global cut at the master node.

### Pause / loading

- `setSceneAlive(false)` fires when `state.kind === 'loading' || state.kind === 'paused'`.
- Engine ramps out over 300ms; boost ramps out as `factor` decays (the existing boost controller stops being ticked when `integratesIn(sceneState)` is false, but `useScene` will explicitly `setBoost(false, 0)` on transition to non-alive to guarantee silence).

### Tab blur

- Browser may suspend the AudioContext on tab blur — accepted. Sound resumes when the tab regains focus. No explicit handling.

### Asset load failure

- If `fetch` or `decodeAudioData` fails, the service logs a single `console.warn`, transitions to `disposed`, and all setters become no-ops. No user-visible error. The scene continues silent.

---

## Browser autoplay handling

Internal to `createSpaceshipAudio`:

1. Construction:
   - Create `AudioContext` (starts `suspended` in all modern browsers without prior user activation).
   - Register one-shot `pointerdown` and `keydown` listeners on `window`.
   - Begin async fetch + decode of both `.mp3` files (in parallel, via `fetch` + `ctx.decodeAudioData`).
   - State = `{ kind: 'pre_gesture', pending: defaultPending }`.

2. Setter calls before first gesture:
   - Update `pending`. Do not touch the graph (graph nodes don't exist yet anyway).

3. First gesture (whichever fires first):
   - `await ctx.resume()`.
   - Await the in-flight buffer-decode promises.
   - Build node graph: `source → channelGain → master → ctx.destination` (one chain per loop).
   - Start both sources with `loop = true`. Engine starts at gain 0; ramp to target if `pending.sceneAlive`. Boost starts at gain 0; jump to `BOOST_MASTER * pending.boostFactor`.
   - Apply `pending.muted` to master gain.
   - Transition state to `ready`. Remove the gesture listeners.

4. Race: if `dispose()` is called before the gesture or before buffers decode:
   - Transition state to `disposed`. Cancel listeners. Subsequent gesture fires are no-ops.

No user-visible overlay or prompt. The mute icon is clickable before the first gesture (clicking it counts as a gesture and unlocks the context — the click handler calls `setMuted(true)`, the service routes the gesture into unlock, and the toggle immediately reflects the muted state).

---

## Data flow

| Source | Signal | Pushed via | Cadence |
|---|---|---|---|
| `useScene` | `sceneAlive = state.kind === 'playing' \|\| state.kind === 'revealing'` | `useEffect([state.kind])` → `audio.setSceneAlive(alive)`. On the falsy transition also calls `audio.setBoost(false, 0)`. | On state-kind transition |
| `Player.tsx` `useFrame` | `boost.kind, boost.factor` (from `boostController.tick`) | `audio.setBoost(boost.kind === 'active', boost.factor)` after the existing `writeTrailOpacities` call | Per frame while `integratesIn(sceneState)` |
| `useMute` (widget) | `muted` (localStorage-backed boolean) | `useEffect([muted])` → `audio.setMuted(muted)` | On toggle |

`Player.tsx` already has the `boost` value in scope from `boostController.tick(...)` — adding `audio.setBoost(...)` is a one-line addition. The `audio` is passed through as a new prop on `Scene` and `Player`.

The audio service is purely reactive. No internal `requestAnimationFrame`. No internal tick.

---

## Mute UI

### Visual

- Position: `position: fixed; top: 1.5rem; left: 1.5rem; z-index: 50`. Symmetric with the existing `CompanyInfoPanel` at `top-6 right-6` so the two corners balance when the reveal panel is open. Clear of the bottom-center CommsDock.
- Container: 40×40 button (a11y hit target), 24×24 icon inside, centered.
- Visual treatment:
  - Background: `rgba(0,0,0,0.25)` with `backdrop-filter: blur(8px)` for legibility over any scene content.
  - Border: `1px solid rgba(255,255,255,0.08)` for definition.
  - Border-radius: `9999px` (full circle).
  - Idle opacity: 0.55. Hover/focus opacity: 1.0. Transition: 200ms ease.
  - Focus ring: visible, matches existing button focus treatment.
- Icons (from `lucide-react`, already a dep):
  - Unmuted: `Volume2`
  - Muted: `VolumeX`
- Element: real `<button type="button">`, `aria-label="Mute audio"` / `aria-label="Unmute audio"` toggled by state, `aria-pressed={muted}`.

### Behavior

- Default: unmuted (localStorage key `audio.muted` absent or `"false"`).
- Click: toggle. New value persisted to `localStorage` synchronously. `useEffect` watching `muted` pushes to `audio.setMuted(muted)`.
- Always mounted whenever `SceneWidget` is mounted — visible regardless of scene state (visible during `loading` so the user can mute before audio starts).

### Component shape

```typescript
// MuteToggle.tsx — pure, controlled
type MuteToggleProps = {
  readonly muted: boolean;
  readonly onToggle: () => void;
};
```

No data hooks. No router. No `useEffect`. Renders the right icon based on `muted`, emits `onToggle` on click.

### Widget shape

```typescript
// useMute.ts
type UseMuteResult = {
  readonly muted: boolean;
  readonly onToggle: () => void;
};

export const useMute = (): UseMuteResult;
```

```typescript
// MuteToggleWidget.tsx — thin shell
export const MuteToggleWidget = (): JSX.Element => {
  const { muted, onToggle } = useMute();
  return <MuteToggle muted={muted} onToggle={onToggle} />;
};
```

The widget owns its own mute state. `useScene` does **not** own mute — it just receives the audio service handle and pushes scene-alive into it. Mute pushes happen via a separate `useEffect` inside whichever hook ends up owning the audio handle (see "Open wiring detail" below).

### Wiring split

`useMute` owns mute state with localStorage + `'storage'` event sync. It is called twice — once inside `useScene` (which pushes the boolean to the audio service via `useEffect`), once inside `MuteToggleWidget` (for the icon render). Same source of truth (localStorage), independently subscribed.

This keeps the audio plumbing and the mute UI as two unrelated consumers of one boolean — neither has to know the other exists, and `useScene` does not have to thread mute state down to a separate widget.

---

## Volume & smoothing constants

All in the service module, top-of-file:

| Constant | Value | Why |
|---|---|---|
| `ENGINE_TARGET_GAIN` | 0.35 | Ambient — present but doesn't dominate |
| `BOOST_MASTER_GAIN` | 0.55 | Foreground — distinctly audible during boost |
| `ENGINE_RAMP_SECONDS` | 0.3 | Smooth fade in/out on scene transitions |
| `MUTE_RAMP_SECONDS` | 0.15 | Quick but clickless mute toggle |

Initial values. Tuning lives in this file only — if the perceived mix is wrong after hearing the audio in context, adjust the constants here, no graph changes.

---

## Tests (TDD)

All tests run under Vitest + jsdom (existing setup). Web Audio API is not in jsdom, so the service tests use a hand-rolled minimal `AudioContext` fake injected via constructor dependency injection.

### `createSpaceshipAudio.test.ts`

The service factory accepts an optional `AudioContextCtor` parameter (default `window.AudioContext`) for test injection.

Bullets:
- `setSceneAlive(true)` before gesture: pending; no audio nodes created.
- Gesture fires → context resumes → buffers decode → graph built → engine gain ramps to target.
- `setSceneAlive(false)` after ready: engine gain ramps to 0 over 300ms.
- `setBoost(true, 0.5)` after ready: boost gain set to `0.55 * 0.5 = 0.275`.
- `setBoost(false, 0)`: boost gain set to 0.
- `setMuted(true)`: master gain ramps to 0.
- `setMuted(false)`: master gain ramps to 1.
- `dispose()` before gesture: cancels listeners; subsequent gesture is a no-op.
- `dispose()` after ready: stops both sources; subsequent setters are no-ops.
- Asset fetch failure: state transitions to `disposed`; `console.warn` called once; subsequent setters are no-ops.

### `MuteToggle.test.tsx`

- Renders `Volume2` icon when `muted === false`.
- Renders `VolumeX` icon when `muted === true`.
- Click fires `onToggle`.
- Has `aria-label="Mute audio"` when unmuted, `aria-label="Unmute audio"` when muted.
- Has `aria-pressed={muted}`.

### `useMute.test.ts`

- Default state is `muted: false` when localStorage is empty.
- Reads existing `audio.muted="true"` from localStorage on mount.
- `onToggle()` flips the value and writes to localStorage.
- A `'storage'` event with the mute key updates the hook (cross-tab sync).

### Integration

- Extend `useScene.smoke.test.tsx` with an assertion that the audio service is instantiated and `setSceneAlive` is called with `true` after the `start` event transitions scene to `playing`. Verify via the injected fake context.

---

## Theme music (future, not built)

When the music file lands, the addition is:

1. Extend `SpaceshipAudio` port with `setMusic(playing: boolean)`.
2. Add a third audio node chain (music source → music gain → master).
3. Decide whether `MuteToggle` covers music too (likely yes — single mute = all audio off) or whether music gets its own separate control (probably for power-users; defer).
4. Add `useEffect` in `useScene` pushing a music-playing boolean (e.g., scene-alive AND not in some specific moment).

No core changes. No widget reshuffling. Strictly additive within `features/audio/`. This is documented here as the rationale for landing the audio feature in its own folder today — **not** as preemptive scaffolding (no music nodes, setters, or UI exist in this spec).

---

## Iron Law conformance

- **Iron Law 1 (Hexagonal):** Audio service is a `services/` adapter — pure callback API, zero React, zero domain knowledge. Components (`MuteToggle`) are pure-render. Wiring (`useScene`, `useMute`) lives in composition roots. No layer reaches across — `Player` calls `audio.setBoost(...)` through the declared port type; the service does not know it's being called from a render loop.
- **Iron Law 2 (Discriminated Unions):** `AudioInternal` is a flat tagged union. No optional-field soup. Pending-setter capture vs ready-graph are different variants with different fields.
- **Iron Law 3 (Make Illegal States Unrepresentable):** "Playing audio before unlock" cannot happen — `pre_gesture` variant has no source/gain nodes; `ready` is the only variant with a graph. "Setter after dispose" is a no-op by exhaustive switch on the discriminator.
- **Iron Law 4 (Solve More With Less):** No preemptive music scaffolding. No volume-slider primitive when only mute is needed. No abstraction layer between the boost signal and the audio gain — the upstream smoothing is reused directly. The audio service has four methods, period.

---

## Files touched

New:
- `src/features/audio/types/audio-orchestrator.ts`
- `src/features/audio/services/createSpaceshipAudio.ts`
- `src/features/audio/services/createSpaceshipAudio.test.ts`
- `src/features/audio/components/MuteToggle/MuteToggle.tsx`
- `src/features/audio/components/MuteToggle/MuteToggle.test.tsx`
- `src/features/audio/widget/mute/useMute.ts`
- `src/features/audio/widget/mute/useMute.test.ts`
- `src/features/audio/widget/mute/MuteToggleWidget.tsx`

Modified:
- `src/features/scene/widget/scene/useScene.ts` — instantiate audio service; push sceneAlive + muted; return audio handle.
- `src/features/scene/widget/scene/SceneWidget.tsx` — mount `<MuteToggleWidget />`; pass audio to `<Scene />`.
- `src/features/scene/components/Scene/Scene.tsx` — accept `audio` prop; thread to `<Player />`.
- `src/features/scene/components/Scene/Player.tsx` — accept `audio` prop; call `audio.setBoost(...)` in `useFrame` after the existing boost tick.
- `src/features/scene/widget/scene/useScene.smoke.test.tsx` — extend with audio-instantiation assertion.

No deletions. No public API removals.
