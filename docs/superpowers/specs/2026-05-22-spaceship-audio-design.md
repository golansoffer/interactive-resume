# Spaceship Audio — Design

**Date:** 2026-05-22
**Scope:** Add three audio sources to the scene — `rocket_engine.mp3` (ambient engine, plays whenever the scene is live), `rocket_boost.mp3` (boost layer, gain follows the existing smoothed boost factor), and `theme.mp3` (main soundtrack, plays whenever the scene is live). Add a top-left UI cluster: a mute toggle and a settings panel exposing four volume sliders (master, music, engine, boost) for live AAA-style mix tuning. All settings persisted in localStorage.

---

## Goal

The scene currently has no audio. The user has dropped three `.mp3` files into `public/audio/`:
- `rocket_engine.mp3` (~327 KB) — covers idle and moving (one continuous engine loop).
- `rocket_boost.mp3` (~36 KB) — plays while space-bar boost is active.
- `theme.mp3` (~6.1 MB) — main theme soundtrack, loops for the duration of the scene.

All three are scene-only. The audio must:

1. **Layer cleanly across three channels.** Engine + boost are diegetic SFX; theme is non-diegetic music sitting underneath. The mix must be tunable live.
2. **Stay silent during `loading` and `paused`.** All three channels gate on `sceneAlive`. Boost additionally rides on the existing smoothed `boost.factor` so the cancel-on-proximity latch is honored for free.
3. **Respect browser autoplay policy.** AudioContext stays `suspended` until the first user gesture (key press or pointer-down). No "click to enable sound" overlay.
4. **Be controllable.** A mute toggle (instant) and a settings panel (4 sliders: Master / Music / Engine / Boost + Reset). No keyboard shortcut. All persisted in localStorage.
5. **Default to a AAA-tuned starting mix.** Music sits underneath SFX; engine is ambient; boost peaks above. User tunes from there via the sliders.
6. **Not block scene render on the 6 MB theme download.** Async decode in parallel with engine/boost; music starts when ready.

## Non-goals

- No keyboard mute or volume shortcuts.
- No per-axis spatialization (no `PannerNode`). All three channels are 2D stereo.
- No engine-volume modulation by speed. Single engine file covers idle and moving — constant gain while scene is live.
- No music-skip / next-track UI. One looping theme.
- No music ducking under reveal panels or boost. Theme stays at its slider-set level always.
- No reactivity to motion-reduced preference (audio ≠ motion).
- No audio analytics, no waveform visualization.
- No core/ domain logic — audio is reactive plumbing over signals already shaped by core (`SceneState`, `BoostStep`).

---

## Architecture

### Layer placement

New vertical-slice feature `features/audio/`, mirroring the shape of `features/comms/`, `features/scene/`, `features/ships/`.

```
features/audio/
├── types/
│   ├── audio-orchestrator.ts        — SpaceshipAudio port + AudioChannel union
│   └── audio-settings.ts            — AudioSettings shape + DEFAULT_AUDIO_SETTINGS
├── services/
│   ├── createSpaceshipAudio.ts      — Web Audio adapter; pure callback API; no React
│   └── createSpaceshipAudio.test.ts
├── components/
│   ├── MuteToggle/
│   │   ├── MuteToggle.tsx           — pure controlled icon-button
│   │   └── MuteToggle.test.tsx
│   ├── SettingsTrigger/
│   │   ├── SettingsTrigger.tsx      — pure cog icon-button (toggles panel open)
│   │   └── SettingsTrigger.test.tsx
│   └── AudioSettingsPanel/
│       ├── AudioSettingsPanel.tsx   — pure panel (header + 4 sliders + reset)
│       ├── AudioSettingsPanel.test.tsx
│       ├── VolumeSlider.tsx         — pure single-row slider component
│       └── VolumeSlider.test.tsx
└── widget/
    └── controls/
        ├── useAudioSettings.ts      — localStorage-backed AudioSettings
        ├── useAudioSettings.test.ts
        └── AudioControlsWidget.tsx  — composes mute + cog + panel; owns panel-open state
```

Touch points outside the new feature:

```
features/scene/widget/scene/useScene.ts        — instantiates createSpaceshipAudio(); subscribes to useAudioSettings(); pushes all signals
features/scene/widget/scene/SceneWidget.tsx    — mounts <AudioControlsWidget />; passes audio to <Scene />
features/scene/components/Scene/Scene.tsx      — accepts audio prop, threads to Player
features/scene/components/Scene/Player.tsx     — calls audio.setBoost in useFrame after boostController.tick
```

No `core/` addition. No new state machine. No new schema (zod). No new route. No URL state.

### Dependency rule

```
SceneWidget → AudioControlsWidget → MuteToggle, SettingsTrigger, AudioSettingsPanel (pure UI; lucide-react icons)
SceneWidget → useScene → createSpaceshipAudio (service)
                       → useAudioSettings (localStorage hook)
useScene → Scene → Player → audio.setBoost(…)  (per-frame)
useScene → useEffect → audio.setSceneAlive(…)         (on state.kind transition)
useScene → useEffect → audio.setMuted(…) + audio.setVolume(channel, value) × 4  (on settings change)
AudioControlsWidget → useAudioSettings (independent subscription to same localStorage entry)
```

Cross-feature traffic flows only through declared ports (`SpaceshipAudio`, `AudioSettings`, the existing `SceneState`, the existing `BoostStep`-shaped values). The audio service is unaware of React, the router, the FSM. The components are unaware of Web Audio.

### Port

```typescript
// features/audio/types/audio-orchestrator.ts

export type AudioChannel = 'master' | 'music' | 'engine' | 'boost';

export type SpaceshipAudio = {
  readonly setSceneAlive: (alive: boolean) => void;
  readonly setBoost: (active: boolean, factor: number) => void;
  readonly setMuted: (muted: boolean) => void;
  readonly setVolume: (channel: AudioChannel, value: number) => void;
  readonly dispose: () => void;
};
```

Five methods. `setVolume` accepts a tagged channel name — the union of valid channels is the type itself, so "invalid channel" is unrepresentable at call sites. Each setter is idempotent (re-pushing the same value is a no-op at the graph level).

### Settings shape

```typescript
// features/audio/types/audio-settings.ts

export type AudioSettings = {
  readonly muted: boolean;
  readonly master: number;  // [0, 1]
  readonly music: number;   // [0, 1]
  readonly engine: number;  // [0, 1]
  readonly boost: number;   // [0, 1]
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  master: 1.0,   // Default to full; user pulls down if too loud overall.
  music: 0.5,    // Theme sits underneath gameplay.
  engine: 0.4,   // Ambient SFX, always present.
  boost: 0.7,    // Peak impact when held.
};
```

These are tuned against AAA-game convention: master at full, music ~50%, SFX 40–70% depending on prominence. Actual perceived balance depends on the recording levels of the `.mp3` files; the user dials in the final mix via the sliders.

### Internal state (discriminated union, Iron Law 2)

```typescript
type AudioInternal =
  | { readonly kind: 'pre_gesture'; readonly pending: PendingState }
  | {
      readonly kind: 'ready';
      readonly ctx: AudioContext;
      readonly muteGain: GainNode;
      readonly masterGain: GainNode;
      readonly channels: ChannelGraph;
      readonly sources: SourceGraph;
      readonly current: CurrentState;
    }
  | { readonly kind: 'disposed' };

type ChannelGraph = {
  readonly music: GainNode;
  readonly engine: GainNode;
  readonly boost: GainNode;
};

type SourceGraph = {
  readonly music: AudioBufferSourceNode;
  readonly engine: AudioBufferSourceNode;
  readonly boost: AudioBufferSourceNode;
};

type CurrentState = {
  readonly sceneAlive: boolean;
  readonly boostFactor: number;
  readonly settings: AudioSettings;
};

type PendingState = {
  readonly sceneAlive: boolean;
  readonly boostActive: boolean;
  readonly boostFactor: number;
  readonly settings: AudioSettings;
};
```

Three discriminator variants:
- `pre_gesture` — no graph; setter calls update `pending`.
- `ready` — graph live; setter calls recompute gains and write through.
- `disposed` — terminal; setter calls are no-ops.

This makes "playing before unlock" and "setter after dispose" both structurally unrepresentable.

### Audio graph (signal flow)

```
musicSource  → musicChannelGain ─┐
engineSource → engineChannelGain ─┼→ masterGain → muteGain → ctx.destination
boostSource  → boostChannelGain ──┘
```

Gain values at any moment:
- `musicChannelGain.gain` = `sceneAlive ? settings.music : 0`
- `engineChannelGain.gain` = `sceneAlive ? settings.engine : 0`
- `boostChannelGain.gain` = `settings.boost * boostFactor` (always; `boostFactor` is naturally 0 when not held / not active)
- `masterGain.gain` = `settings.master`
- `muteGain.gain` = `settings.muted ? 0 : 1`

`muteGain` is split out from `masterGain` so muting doesn't overwrite the user's master volume — un-muting restores the prior level cleanly.

---

## Behavior

### Engine loop

- Plays continuously while `sceneAlive === true`.
- Channel gain = `settings.engine` while alive, ramped to 0 over 300ms on transition to non-alive.
- Source starts at first-gesture unlock with `loop = true`; never stopped — gain controls audibility.

### Boost loop

- Always looping. Channel gain = `settings.boost * boost.factor`.
- `setBoost(active, factor)` writes directly via `setValueAtTime` (no double-smoothing — `factor` is already smoothed upstream by `boostController`).
- `active` is part of the upstream `BoostStep` shape and is therefore part of the port signature for fidelity to the source value; gain is derived from `factor` alone since `factor` already encodes active-ness through the smoothing.

### Music loop

- Plays continuously while `sceneAlive === true`. No ducking, no skipping, no fade between sections.
- Channel gain = `settings.music` while alive, ramped to 0 over 300ms on transition to non-alive.
- Source starts at first-gesture unlock OR when the (6 MB) buffer finishes decoding — whichever is later. Until then, the music source slot is empty; the rest of the graph is fully functional.
- `loop = true`.

### Mute

- `setMuted(true)` ramps `muteGain` from 1 → 0 over 150ms.
- `setMuted(false)` ramps `muteGain` from 0 → 1 over 150ms.
- Per-channel and master gains stay at their user-set values — mute is a single global cut at the final node.

### Volume changes

- `setVolume(channel, value)` recomputes the affected gain and writes it directly.
- No ramp on volume slider drags — sliders should feel immediate; tiny audible steps during drag are expected and fine.
- One exception: when `boost` channel volume changes, the new value is multiplied with the live `boostFactor` and written through, so the slider takes effect mid-boost without dropping or jumping the level discontinuously.

### Pause / loading

- `setSceneAlive(false)` fires when `state.kind === 'loading' || state.kind === 'paused'`.
- Engine + music channel gains ramp to 0 over 300ms; boost is forced to `(false, 0)` by `useScene` on the non-alive transition to guarantee silence.

### Tab blur

- Browser may suspend the AudioContext on tab blur — accepted. Sound resumes when the tab regains focus. No explicit handling.

### Asset load failure

- If `fetch` or `decodeAudioData` fails for a given file, that channel stays silent for the session; others continue. Service logs a single `console.warn` per failure. No user-visible error.
- If ALL three fail, the service transitions to `disposed` and all setters become no-ops.

---

## Browser autoplay handling

Internal to `createSpaceshipAudio`:

1. **Construction:**
   - Create `AudioContext` (starts `suspended`).
   - Register one-shot `pointerdown` and `keydown` listeners on `window`.
   - Begin parallel `fetch` + `ctx.decodeAudioData` for all three files. Track each via its own promise.
   - State = `{ kind: 'pre_gesture', pending: defaultPending }`.

2. **Setter calls before first gesture:**
   - Update `pending`. Do not touch the graph.

3. **First gesture (whichever fires first):**
   - `await ctx.resume()`.
   - Build the static graph: `masterGain → muteGain → ctx.destination`, plus the three channel gains routed into `masterGain`. Apply pending settings to all gains.
   - For each buffer-decode promise that has already resolved: create the source, connect to its channel gain, `start(0)` with `loop = true`.
   - For each promise still in flight: when it resolves, create + start the source then.
   - Remove the gesture listeners. Transition state to `ready` (the engine/boost may be playing already; music joins when its buffer arrives).

4. **Race: `dispose()` before gesture or before any buffers decode:**
   - Transition state to `disposed`. Cancel listeners. Any subsequent buffer-decode resolution is dropped.

No user-visible "click to enable" overlay. Clicking the mute icon, the cog, or any slider before the first gesture acts as the gesture and unlocks the context.

---

## Data flow

| Source | Signal | Pushed via | Cadence |
|---|---|---|---|
| `useScene` | `sceneAlive = state.kind ∈ {playing, revealing}` | `useEffect([sceneAlive, audio])` → `audio.setSceneAlive(alive)`. On `false` transition also `audio.setBoost(false, 0)` for safety. | On state-kind transition |
| `Player.tsx` `useFrame` | `boost.kind, boost.factor` (from `boostController.tick`) | `audio.setBoost(boost.kind === 'active', boost.factor)` after the existing `writeTrailOpacities` call | Per frame while `integratesIn(sceneState)` |
| `useAudioSettings` (in `useScene`) | `settings: AudioSettings` | One `useEffect([settings, audio])` that calls `setMuted` + `setVolume` for all 4 channels | On any settings field change |

`Player.tsx` already has the `boost` value in scope from `boostController.tick(...)` — adding `audio.setBoost(...)` is a one-line addition. `audio` is passed through as a new prop on `Scene` and `Player`.

The audio service is purely reactive. No internal `requestAnimationFrame`. No internal tick.

---

## UI

### Top-left cluster

Two icon-buttons arranged horizontally, both `position: fixed; top: 1.5rem; left: 1.5rem; z-index: 50`:

```
[Mute] [Cog]   ←— 40×40 each, 8px gap
```

Symmetric balance with the `CompanyInfoPanel` at `top-6 right-6`. Always mounted with `SceneWidget` (visible during `loading` so the user can mute or tune before audio starts).

### MuteToggle component (pure)

- 40×40 button, 24×24 lucide icon centered.
- Icons: `Volume2` (unmuted) / `VolumeX` (muted) from `lucide-react`.
- Visual: `bg-black/25` with `backdrop-blur-md`, `border border-white/10`, fully rounded.
- Idle opacity 0.55, hover/focus 1.0, 200ms ease transition.
- `<button type="button">`, `aria-label` toggled by state, `aria-pressed={muted}`, visible focus ring.

```typescript
type MuteToggleProps = {
  readonly muted: boolean;
  readonly onToggle: () => void;
};
```

### SettingsTrigger component (pure)

- Same shell as MuteToggle (40×40, same visual treatment).
- Icon: `SlidersHorizontal` from `lucide-react`.
- `<button type="button">`, `aria-label="Audio settings"`, `aria-expanded={open}`, `aria-controls="audio-settings-panel"`.

```typescript
type SettingsTriggerProps = {
  readonly open: boolean;
  readonly onToggle: () => void;
};
```

### AudioSettingsPanel component (pure)

Floats below the cog, anchored to the top-left cluster. Closes on outside click, Escape key, or another cog click.

- Position: `position: fixed; top: 4.5rem; left: 1.5rem; z-index: 50` (sits beneath the icon row).
- Width: 18rem.
- Visual: matches `CompanyInfoPanel` family — `bg-card/85`, `backdrop-blur-md`, `ring-1 ring-foreground/10`, `shadow-2xl`, `rounded-xl`, `p-4`.
- Open/close animation: 200ms fade + 4px translate-up.

Contents:
1. Small header `Audio` (text-xs uppercase tracking-wider muted).
2. Four `VolumeSlider` rows in order: `Master`, `Music`, `Engine`, `Boost`.
3. Footer: small "Reset to defaults" link button on the right.

```typescript
type AudioSettingsPanelProps = {
  readonly settings: AudioSettings;
  readonly onSetVolume: (channel: AudioChannel, value: number) => void;
  readonly onReset: () => void;
  readonly id: string;  // for aria-controls linkage from SettingsTrigger
};
```

The panel does not contain its own mute toggle — mute lives in the always-visible top-left button. Keeping them separate avoids a "double mute" UI.

### VolumeSlider component (pure)

A single row inside the panel — label, value readout, native range input.

```typescript
type VolumeSliderProps = {
  readonly label: string;            // e.g., "Master"
  readonly value: number;            // [0, 1]
  readonly onChange: (value: number) => void;
};
```

Layout:
```
Master                    80%
[━━━━━━━━○━━━━━━━━━]
```

- Native `<input type="range" min="0" max="100" step="1">` styled with custom CSS (track + thumb). Keyboard arrows / Home / End all work for free.
- Label: `text-xs uppercase tracking-wide text-muted-foreground` (matches existing app typography).
- Value readout right-aligned, monospace, `text-xs tabular-nums text-muted-foreground`.
- The value displayed and emitted as percentages (0–100) at the slider boundary; the `onChange` callback receives the [0, 1] domain value (divided by 100).
- `aria-label={label}`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow={Math.round(value * 100)}`.

### AudioControlsWidget composition

```typescript
export const AudioControlsWidget = (): JSX.Element => {
  const { settings, setMuted, setVolume, reset } = useAudioSettings();
  const [panelOpen, setPanelOpen] = useState(false);
  // Outside-click + Escape close handlers via useEffect on panelOpen.
  return (
    <>
      <div className="fixed top-6 left-6 z-50 flex gap-2">
        <MuteToggle muted={settings.muted} onToggle={() => setMuted(!settings.muted)} />
        <SettingsTrigger open={panelOpen} onToggle={() => setPanelOpen((p) => !p)} />
      </div>
      {panelOpen && (
        <AudioSettingsPanel
          settings={settings}
          onSetMuted={setMuted}
          onSetVolume={setVolume}
          onReset={reset}
          id="audio-settings-panel"
        />
      )}
    </>
  );
};
```

The widget owns transient panel-open state (not persisted — opens closed on every page load). Settings are persisted via `useAudioSettings`.

### Wiring split

`useAudioSettings` owns the persisted struct with localStorage + `'storage'` event sync. It is called **twice in the tree**:
1. Inside `useScene` — for pushing values into the audio service via `useEffect`.
2. Inside `AudioControlsWidget` — for rendering and editing.

Both subscribe to the same localStorage entry; cross-tab and cross-component sync happen via the `'storage'` event and synchronous re-read on update. This keeps the audio service and the UI as two unrelated consumers — neither has to thread state through the other.

---

## Persistence

Single localStorage key: `audio.settings`. Value: JSON-encoded `AudioSettings`.

`useAudioSettings`:
- On mount: read + parse. If missing, malformed, or out-of-range, fall back to `DEFAULT_AUDIO_SETTINGS`.
- On any setter: write the new struct atomically.
- Subscribe to `window` `'storage'` event filtered on `e.key === 'audio.settings'`; reparse and update on cross-tab change.
- `reset()` writes `DEFAULT_AUDIO_SETTINGS`.

Parsing is defensive at the boundary (parse-don't-validate, Iron Law 3): a small parser function converts unknown JSON to `AudioSettings` or returns the default. Downstream consumers receive a guaranteed-valid struct.

---

## Volume & ramp constants

In the service module, top-of-file:

| Constant | Value | Why |
|---|---|---|
| `CHANNEL_RAMP_SECONDS` | 0.3 | Smooth channel fade in/out on scene-alive transitions |
| `MUTE_RAMP_SECONDS` | 0.15 | Quick but clickless mute toggle |

In `audio-settings.ts`:

| Field | Default | Why |
|---|---|---|
| `master` | 1.0 | Full headroom; user pulls down if needed |
| `music` | 0.5 | Theme sits underneath SFX |
| `engine` | 0.4 | Ambient — present but not dominant |
| `boost` | 0.7 | Peak impact moment |
| `muted` | false | Audio on by default; user can mute |

These defaults follow AAA convention (master at full headroom, music underneath SFX, ambient SFX gentle, peak SFX prominent). The sliders exist so the user can dial in the final mix once the files are heard in context — that tuning is the panel's reason to exist, not a deferred "we'll fix it later."

---

## Tests (TDD)

All tests run under Vitest + jsdom. Web Audio is not in jsdom — service tests inject a hand-rolled minimal `AudioContext` fake via a constructor parameter.

### `createSpaceshipAudio.test.ts`

The service factory accepts an optional `AudioContextCtor` parameter (default `window.AudioContext`) for test injection. Plus an optional `fetch` injection for asset loading.

Bullets:
- Construction → state is `pre_gesture`; no graph nodes yet; fetches initiated for all three files.
- `setSceneAlive(true)` before gesture: pending captured; no audio nodes.
- Gesture fires → ctx resumes → graph built (master + mute + three channels) → engine + boost sources start (if buffers decoded) → music source starts when its buffer arrives.
- After ready, `setSceneAlive(false)`: engine + music gains ramp to 0 over 300ms.
- After ready, `setBoost(true, 0.5)` with `settings.boost = 0.7`: boost channel gain = `0.7 * 0.5 = 0.35`.
- After ready, `setBoost(false, 0)`: boost channel gain = 0.
- `setMuted(true)`: muteGain ramps to 0 over 150ms.
- `setMuted(false)`: muteGain ramps to 1 over 150ms.
- `setVolume('master', 0.5)`: masterGain = 0.5.
- `setVolume('music', 0.3)`: musicChannelGain = `sceneAlive ? 0.3 : 0`.
- `setVolume('boost', 0.4)` while `boostFactor = 0.6`: boost channel gain = `0.4 * 0.6 = 0.24`.
- `dispose()` before gesture: listeners cancelled; subsequent gesture is a no-op; pending buffer resolutions dropped.
- `dispose()` after ready: stops all sources; setters become no-ops.
- Per-file asset load failure: that channel stays silent; one `console.warn`; other channels work.
- All-files failure: state transitions to `disposed`.

### `MuteToggle.test.tsx`

- Renders `Volume2` icon when `muted === false`.
- Renders `VolumeX` icon when `muted === true`.
- Click fires `onToggle`.
- `aria-label="Mute audio"` / `"Unmute audio"` toggle.
- `aria-pressed={muted}`.

### `SettingsTrigger.test.tsx`

- Renders `SlidersHorizontal` icon.
- Click fires `onToggle`.
- `aria-expanded={open}`, `aria-controls="audio-settings-panel"`.

### `AudioSettingsPanel.test.tsx`

- Renders four `VolumeSlider` rows labeled `Master`, `Music`, `Engine`, `Boost`.
- Sliders show the correct values from `settings`.
- Slider input fires `onSetVolume(channel, value)` with the right channel + [0, 1] domain value.
- Reset button fires `onReset`.

### `VolumeSlider.test.tsx`

- Renders label, readout (e.g., `"80%"`), and `<input type="range">`.
- Initial input value matches `value * 100`.
- Input change fires `onChange(value / 100)`.
- Has `aria-valuenow={Math.round(value * 100)}`, `aria-valuemin="0"`, `aria-valuemax="100"`.

### `useAudioSettings.test.ts`

- Default state is `DEFAULT_AUDIO_SETTINGS` when localStorage is empty.
- Reads + parses existing JSON on mount; malformed JSON falls back to defaults.
- Out-of-range values (e.g., `master: 5.0`) are clamped or fall back to defaults via the parser.
- `setMuted(true)` updates state + writes localStorage.
- `setVolume('music', 0.3)` updates state + writes localStorage.
- `reset()` restores defaults + writes localStorage.
- A `'storage'` event with the audio key triggers a re-read (cross-tab sync).

### Integration

- Extend `useScene.smoke.test.tsx` with an assertion that the audio service is instantiated and `setSceneAlive(true)` is called after the `start` event transitions scene to `playing`. Verify via injected fake context.

---

## Iron Law conformance

- **Iron Law 1 (Hexagonal):** Audio service is a pure `services/` adapter — callback API, zero React, zero domain. Components are pure-render. Wiring lives in composition roots (`useScene`, `useAudioSettings`, `AudioControlsWidget`). No layer reaches across — `Player` calls `audio.setBoost(...)` through the declared port; the service does not know it's being called from a render loop. The panel does not know mute exists; the mute button does not know the panel exists; both observe the same localStorage truth via `useAudioSettings`.
- **Iron Law 2 (Discriminated Unions):** `AudioInternal` is a flat tagged union (`pre_gesture | ready | disposed`). `AudioChannel` is a string-literal union. `AudioSettings` is a flat record with no optional fields.
- **Iron Law 3 (Make Illegal States Unrepresentable):** "Playing audio before unlock" cannot happen — `pre_gesture` variant has no source/gain nodes; `ready` is the only variant with a graph. "Setter after dispose" is a no-op by exhaustive switch on the discriminator. "Invalid channel" cannot be passed — the union is the type. Parsing at the localStorage boundary returns either valid `AudioSettings` or the default — never a partial / invalid struct.
- **Iron Law 4 (Solve More With Less):** Five setters cover all behavior; no per-channel-volume helpers. One JSON-encoded localStorage key, not five. One reactive `useEffect` pushes all settings to the service. No abstraction layer between the boost factor and the audio gain. The pure components have zero internal state — `AudioControlsWidget` owns only the panel-open boolean.

---

## Files touched

New:
- `src/features/audio/types/audio-orchestrator.ts`
- `src/features/audio/types/audio-settings.ts`
- `src/features/audio/services/createSpaceshipAudio.ts`
- `src/features/audio/services/createSpaceshipAudio.test.ts`
- `src/features/audio/components/MuteToggle/MuteToggle.tsx`
- `src/features/audio/components/MuteToggle/MuteToggle.test.tsx`
- `src/features/audio/components/SettingsTrigger/SettingsTrigger.tsx`
- `src/features/audio/components/SettingsTrigger/SettingsTrigger.test.tsx`
- `src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.tsx`
- `src/features/audio/components/AudioSettingsPanel/AudioSettingsPanel.test.tsx`
- `src/features/audio/components/AudioSettingsPanel/VolumeSlider.tsx`
- `src/features/audio/components/AudioSettingsPanel/VolumeSlider.test.tsx`
- `src/features/audio/widget/controls/useAudioSettings.ts`
- `src/features/audio/widget/controls/useAudioSettings.test.ts`
- `src/features/audio/widget/controls/AudioControlsWidget.tsx`

Modified:
- `src/features/scene/widget/scene/useScene.ts` — instantiate audio service; call useAudioSettings; push sceneAlive + all settings; return audio handle.
- `src/features/scene/widget/scene/SceneWidget.tsx` — mount `<AudioControlsWidget />`; pass audio handle to `<Scene />`.
- `src/features/scene/components/Scene/Scene.tsx` — accept `audio` prop; thread to `<Player />`.
- `src/features/scene/components/Scene/Player.tsx` — accept `audio` prop; call `audio.setBoost(...)` in `useFrame` after the existing boost tick.
- `src/features/scene/widget/scene/useScene.smoke.test.tsx` — extend with audio-instantiation assertion.

No deletions. No public API removals.
