# 3D Renderer — Tech Decision and Foundations Spec

**Date:** 2026-05-19
**Status:** Decision locked. Foundations build deferred to a separate kickoff session.
**Predecessor:** [2026-05-19-interactive-resume-setup-design.md](./2026-05-19-interactive-resume-setup-design.md) (Phase-0 scaffolding).

---

## Scope

Lock the 3D rendering technology, the adapter shape that connects it to the rest of the app, the dependency list, and the asset pipeline. **No code is written or installed in this session.** A follow-up session, kicked off via the prompt at the bottom of this file, will execute the foundations build defined in [§ Foundations scope](#foundations-scope-next-session).

---

## Mechanic (what the design has to support)

One continuous 3D scene. The guest controls an entity (e.g. a spaceship) with the keyboard. Smooth movement, not teleport. The camera follows the entity. When the entity gets close to an object, info about a company the author worked at appears (text on the surface, a floating billboard, or an HTML tooltip — exact form deferred). Each object = one company. Aesthetic undecided; the **mechanic** is fixed.

Targets:

- 60fps on mid-range 2020-era laptops (Apple M1 Air, Intel iGPU equivalents) at 1080p.
- ~20 company objects per scene.
- 3D text or HTML-anchored-to-3D-position overlay for company reveal.
- Optional post-processing headroom (bloom / fog) — not in foundations.

---

## Decision

**Renderer:** `three`
**React reconciler:** `@react-three/fiber` (R3F)
**Helper library:** `@react-three/drei`

### Why R3F over vanilla three.js

R3F's runtime overhead is reconciliation on prop changes, not per-frame work. The `useFrame` render loop runs **outside** React's render cycle — kinematic integration mutates three.js objects via refs at 60Hz with zero React reconciliation. drei gives us SDF text (`<Text>`), HTML overlays anchored to 3D positions (`<Html>`), follow-camera helpers, and `useGLTF` model loading without writing the glue ourselves.

The Iron-Law concern ("scene state lives inside React") is satisfied by **sealing** the entire R3F tree inside `features/scene/widget/scene/SceneWidget.tsx`. Nothing R3F-shaped, nothing `three`-shaped, no refs leak upward. The rest of the app sees `{ state, actions }` from the widget — types only.

### Why not Babylon.js, PlayCanvas, or vanilla three.js

- **Babylon.js** — stronger PBR, built-in collisions, inspector. But a much thinner React-glue ecosystem. For ≤20 objects without physics, a poor trade.
- **PlayCanvas** — runtime + editor product. Heavier; not suited to a single-page React app.
- **Vanilla three.js** — the imperative form of what R3F wraps. Picking it means re-implementing drei's helpers (`<Text>`, `<Html>`, follow-cam, GLTF loader hook) — unjustified cost when the boundary R3F creates is just as clean once sealed inside the widget.

---

## Port shape

The contract crossed at the widget boundary. Every type is a flat discriminated union (Iron Law 2). No optional fields acting as state flags (Iron Law 3).

```typescript
// src/features/scene/types/company.ts
type CompanyId = string & { readonly __brand: 'CompanyId' };

// The ONE constructor that mints a CompanyId. Called only by the canonical
// company-list builder. Anywhere else casting a string to CompanyId is a
// violation enforced by code review and grep.
const asCompanyId = (raw: string): CompanyId => raw as CompanyId;

type Company = {
  readonly id: CompanyId;
  readonly position: readonly [number, number, number];
};

// src/features/scene/types/scene-state.ts
type SceneState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'playing' }
  | { readonly kind: 'revealing'; readonly objectId: CompanyId }
  | { readonly kind: 'paused'; readonly resumeTo: PausedResume };

// `paused` carries the state to restore on resume — Iron Law 3: no optional
// "previous state" field hanging off a shared shape; the resume target is a
// variant of `paused` itself.
type PausedResume =
  | { readonly kind: 'playing' }
  | { readonly kind: 'revealing'; readonly objectId: CompanyId };

// src/features/scene/types/intent.ts
// Continuous kinematic intents — sampled per frame. **Camera-relative**: the
// player moves in the plane defined by the camera's forward and right basis
// vectors. The player mesh has no input-driven heading; rotation (if any) is
// a visual lag of the velocity direction, not a separate input axis.
type Intent =
  | { readonly kind: 'move_forward' }    // along camera forward (XZ-projected)
  | { readonly kind: 'move_backward' }   // opposite of camera forward
  | { readonly kind: 'strafe_left' }     // opposite of camera right
  | { readonly kind: 'strafe_right' };   // along camera right

// Pull-based stream — sampled per frame inside useFrame.
// Not a 60Hz prop diff. This is the load-bearing decision that keeps React quiet during play.
type IntentStream = { readonly current: ReadonlySet<Intent['kind']> };

// src/features/scene/types/keyboard-signal.ts
// What the keyboard adapter says happened. Continuous keys produce
// `intent_down`/`intent_up`; discrete keys produce a `command`. Edge-vs-hold
// classification lives in the adapter, not the consumer.
type KeyboardCommand =
  | { readonly kind: 'interact' }
  | { readonly kind: 'pause_toggle' };

type KeyboardSignal =
  | { readonly kind: 'intent_down'; readonly intent: Intent['kind'] }
  | { readonly kind: 'intent_up'; readonly intent: Intent['kind'] }
  | { readonly kind: 'command'; readonly command: KeyboardCommand };

// src/features/scene/types/scene-event.ts
// What the Scene component observes about its own world and emits to the
// composition root. Spatial observations only — discrete user commands flow
// through `KeyboardSignal`, not through here.
type SceneEvent =
  | { readonly kind: 'entered_proximity'; readonly objectId: CompanyId }
  | { readonly kind: 'exited_proximity'; readonly objectId: CompanyId };

// Inbound port: the props Scene.tsx accepts from the widget.
type SceneProps = {
  readonly state: SceneState;
  readonly companies: ReadonlyArray<Company>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
};
```

**XState `type` vs domain `kind`.** XState v5 requires its events to carry a `type` field; CLAUDE.md requires our domain types to use `kind`. The reconciliation: domain types stay `kind`-tagged everywhere outside the machine. Inside `src/core/scene/sceneMachine.ts`, the machine's event union uses `type` (it's the framework boundary). The widget composition root translates one shape to the other. Translation is mechanical (`{ type: event.kind, ...rest }`) and contains no suppressors.

**Three decoupled layers inside the widget:**

1. **Outside `<Canvas>`** — React + XState. Discrete state changes only (tens per session).
2. **R3F reconciliation** — fires only on `SceneState` transitions. Not at 60Hz.
3. **`useFrame`** — continuous integration. Reads `intents.current` (Ref-backed). Mutates three.js objects directly via refs. Computes proximity. Calls `onEvent` on transitions only.

`Vector3` positions and three.js objects are **internal** to the renderer service and R3F children. They never appear in the inbound or outbound port types.

**Stability.** `onEvent` is wrapped in `useCallback` at the widget so the reference is stable across renders — safe to capture in `useFrame` closures.

---

## Folder shape

```
src/core/scene/                  — pure domain. No React, no R3F, no three.
└── sceneMachine.ts              — XState v5 machine. Pure. Translates from
                                    domain `kind` to XState `type` at this file's
                                    boundary; the rest of `core/scene/` never
                                    surfaces XState types.

src/features/scene/
├── types/
│   ├── scene-state.ts           — SceneState, PausedResume
│   ├── intent.ts                — Intent, IntentStream
│   ├── keyboard-signal.ts       — KeyboardCommand, KeyboardSignal
│   ├── scene-event.ts           — SceneEvent (proximity only)
│   └── company.ts               — CompanyId (branded), asCompanyId, Company
├── services/
│   ├── renderer/                — pure math. No React, no three.js types in signatures.
│   │   ├── integrateMotion.ts
│   │   ├── proximityCheck.ts
│   │   └── clampToBounds.ts
│   ├── input/                   — DOM keyboard adapter. Pure callback API.
│   │   └── subscribeToKeyboard.ts
│   └── assets/                  — created empty (.gitkeep). Populated when GLB loading lands.
├── components/
│   └── Scene/
│       ├── Scene.tsx            — top-level <Canvas> child. Pure renderer.
│       ├── Player.tsx           — useFrame integration via Ref.
│       ├── Companies.tsx        — renders all company markers.
│       ├── FollowCamera.tsx
│       ├── ProximityWatcher.tsx — useFrame; calls onEvent on proximity transitions.
│       └── RevealOverlay.tsx    — drei <Html>. Renders nothing in foundations.
└── widget/
    └── scene/
        ├── useScene.ts          — composition root. The ONE useEffect:
        │                          subscribeToKeyboard → IntentStream Ref + machine.send.
        │                          Translates domain `kind` → XState `type`.
        └── SceneWidget.tsx      — thin shell. Mounts <Canvas>. Renders <Scene />.
```

### `services/input/subscribeToKeyboard.ts` — signature

```typescript
const subscribeToKeyboard = (
  onSignal: (signal: KeyboardSignal) => void,
): (() => void) => { /* attach keydown/keyup, return unsubscribe */ };
```

Pure callback API. No React. No domain knowledge beyond `KeyboardSignal`. The `useEffect` that calls it lives in `useScene.ts`. The adapter classifies keys (continuous → `intent_down`/`intent_up`; discrete → `command` on keydown only, with repeat-event suppression).

### Allowed importers of `three` / `@react-three/fiber` / `@react-three/drei`

- `src/features/scene/widget/scene/**`
- `src/features/scene/components/Scene/**`
- `src/features/scene/services/assets/**` (when populated, for `GLTFLoader` only — see [§ Asset pipeline](#asset-pipeline))

Anywhere else is a violation. Verifiable by grep.

Specifically forbidden:

- `src/core/**` imports R3F / three / drei (Iron Law 1 — core is pure).
- `src/features/scene/services/{renderer,input}/**` imports any of these — these services are React-free and three-free.
- `src/features/scene/types/**` imports anything from a sibling folder.
- `src/routes/**` imports R3F / three / drei directly; the widget is the only door.

### Plain-record math

The `services/renderer/` math modules take plain records (`{ x: number; y: number; z: number }`), not `Vector3`. They are unit-testable with no three.js dependency. The R3F components convert plain records to `Vector3` at their own boundary.

### CompanyId minting

`asCompanyId(raw: string): CompanyId` lives in exactly one file: `src/features/scene/types/company.ts`. The cast `raw as CompanyId` appears nowhere else in the codebase. The only legitimate caller is the canonical company-list builder (a hardcoded `const FOUNDATIONS_COMPANIES: ReadonlyArray<Company>` for foundations, a `schema/` parser later). Grep-enforced.

`schema/` and `api/` are not present yet — there is no external data in foundations. They will arrive when real resume data is wired.

---

## Keybindings

Foundations binds these keys; no remap config. Focus/IME handling is out of foundations scope.

| Key | Output | Channel |
|---|---|---|
| `W` / `ArrowUp` | `move_forward` | continuous → IntentStream |
| `S` / `ArrowDown` | `move_backward` | continuous → IntentStream |
| `A` / `ArrowLeft` | `strafe_left` | continuous → IntentStream |
| `D` / `ArrowRight` | `strafe_right` | continuous → IntentStream |
| `E` | `{ kind: 'interact' }` | discrete → `KeyboardSignal.command` (on keydown only) |
| `Escape` | `{ kind: 'pause_toggle' }` | discrete → `KeyboardSignal.command` (on keydown only) |

Modifier keys ignored. Auto-repeat suppressed for discrete keys. Movement is **camera-relative** (see [§ Movement model](#movement-model)).

## Movement model

The player slides through the world in the plane defined by the camera's basis vectors. There is no input-driven rotation — `Intent` has no `turn_*` variants. The camera is locked to the player position with a fixed orientation (FollowCamera does not rotate at runtime in foundations).

`integrateMotion` signature:

```typescript
type CameraBasis = {
  readonly forward: Vec3;  // camera forward, XZ-projected, normalized
  readonly right: Vec3;    // camera right, XZ-projected, normalized
};

const integrateMotion = (
  state: Kinematics,
  intents: ReadonlySet<Intent['kind']>,
  dt: number,
  basis: CameraBasis,
): Kinematics;
```

Algorithm:

1. Sum a desired direction vector from the held intents in the camera basis (each contributing intent adds or subtracts a basis vector in the XZ plane). Normalize if non-zero.
2. Compute target velocity: `targetVelocity = desiredDirection * MAX_SPEED`.
3. Snap-accelerate / snap-decelerate toward target velocity. Module-local constants tuned for **snappy** feel:
   - `MAX_SPEED ≈ 14` world units / second (≈4.6×PROXIMITY_RADIUS / s — feels fast but not uncontrollable).
   - `ACCELERATION ≈ 120` (time-to-max ≈ 120 ms when no opposing velocity).
   - `DECELERATION ≈ 140` (time-to-stop ≈ 100 ms on key release).
4. Integrate position: `position += velocity * dt` in the XZ plane. Y is held at 0.

Velocity is the load-bearing internal state; heading is no longer used by the integrator. `Kinematics` may keep a `heading` field if the player mesh's facing is later derived from velocity direction, but the integrator does not consume it.

The `Vec3.y` axis is preserved (unused for foundations movement; reserved for later flight).

---

## Proximity

`proximityCheck(playerPosition, companies, radius)` returns the set of `CompanyId`s currently within `radius` of the player. The radius is a Scene-local constant in foundations (e.g. `PROXIMITY_RADIUS = 3` world units). Per-company radii or radius-as-prop are deferred.

`ProximityWatcher` computes the current proximate set each frame, diffs against the previous frame's set, and emits `entered_proximity` for new entries and `exited_proximity` for removed entries. The previous-frame set is stored in a Ref inside the component (not in React state — no re-renders).

---

## Dependencies

To install in the foundations session:

```
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

Deferred until a later session justifies them:

- `@react-three/postprocessing` — when the look needs bloom / fog / DoF.
- `@react-three/rapier` — only if AABB proximity becomes insufficient.

---

## Asset pipeline

Both target packs ship `.glb` (glTF binary), the three.js standard format:

- **Kenney Space Kit** ([kenney.nl/assets/space-kit](https://kenney.nl/assets/space-kit)) — CC0.
- **Quaternius Ultimate Space Kit** ([quaternius.com/packs/ultimatespacekit.html](https://quaternius.com/packs/ultimatespacekit.html)) — most Quaternius packs are CC0; verify the specific download before commit (newest packs are sometimes Patreon-gated).

Plumbing (lands when models are wired, **not** in foundations) — split pre-decided:

- `.glb` files live in `public/models/<pack>/`.
- `src/features/scene/services/assets/` exposes a pure async API — e.g. `loadGltf(url: string): Promise<LoadedModel>` where `LoadedModel` is a parsed-domain type in `features/scene/types/`. The service is React-free and uses three.js `GLTFLoader` directly.
- R3F suspense / `useGLTF` integration lives in `components/Scene/`, consuming `loadGltf` or a thin sync cache. This keeps `services/` React-free per CLAUDE.md.
- Foundations creates the empty `services/assets/` directory with a `.gitkeep`. That's it.

---

## Iron-Law verification

| Law | How it's met |
|---|---|
| **1 Hexagonal** | `core/scene/sceneMachine.ts` is pure — no React, no R3F, no three. `services/{renderer,input}/**` are React-free and three-free. R3F/three/drei live only in `widget/scene/**`, `components/Scene/**`, and (later) `services/assets/**`. Grep-verifiable. The XState framework boundary (event `type` field) is contained inside `core/scene/sceneMachine.ts`; the widget translates. |
| **2 Discriminated unions** | `SceneState`, `Intent`, `SceneEvent`, `KeyboardSignal`, `KeyboardCommand`, `PausedResume`, asset-load state — all tagged. Kinematic state (`Vector3`) is internal to renderer + R3F components; never crosses a port. `Intent` is flat per-variant so `Set<Intent['kind']>` is a faithful projection (no discriminator loss). |
| **3 Illegal states unrepresentable** | `CompanyId` is branded; minted in exactly one place (`asCompanyId` in `types/company.ts`); proximity events for unknown ids cannot be constructed. `revealing` carries `objectId` on the variant; `paused` carries `resumeTo` on the variant — no optionals acting as state flags. Edge-vs-hold input is resolved at the keyboard adapter (the only place classification happens), not at the consumer. |
| **4 Design discipline** | One widget, one canvas, one frame-loop, one keyboard adapter, one event channel out of Scene. `IntentStream` is a Ref-pull, not a 60Hz prop diff — the module-deepening choice instead of bundling per-key props or dispatching 60Hz events. `subscribeToKeyboard` takes a single `KeyboardSignal` callback (one parameter, deep union) rather than three callbacks. |

---

## Performance budget

Worst-case 16.67ms per frame at 60fps:

- Render (~20 simple objects, one directional + one ambient light, no shadow maps): 1–3ms.
- Kinematic integration: <0.1ms.
- Proximity check (O(N) AABB across ~20 objects): negligible.
- R3F reconciliation: ~0 per frame — fires only on `SceneState` transitions, not continuous input.
- drei `<Html>` overlays: one at a time, only during `revealing`.

Dev tooling: drei `<Stats>` overlay during development.

---

## Foundations scope (next session)

**In scope:**

1. Install dependencies: `pnpm add three @react-three/fiber @react-three/drei` + `pnpm add -D @types/three`. (Already done in this session.)
2. Create every type file in `src/features/scene/types/` per [§ Port shape](#port-shape):
   - `company.ts` — `CompanyId` (branded), `asCompanyId` minter, `Company`.
   - `scene-state.ts` — `SceneState`, `PausedResume`.
   - `intent.ts` — `Intent`, `IntentStream`.
   - `keyboard-signal.ts` — `KeyboardCommand`, `KeyboardSignal`.
   - `scene-event.ts` — `SceneEvent`.
3. Create `src/features/scene/services/renderer/` with three pure math modules (`integrateMotion`, `proximityCheck`, `clampToBounds`). Plain-record signatures (no three.js types). Unit-test coverage for each.
4. Create `src/features/scene/services/input/subscribeToKeyboard.ts` per [§ subscribeToKeyboard.ts — signature](#servicesinputsubscribetokeyboardts--signature). Pure callback API. Maps the keybindings in [§ Keybindings](#keybindings). Repeat-suppressed for discrete commands. Unit tests using a fake `window` event target (or JSDOM).
5. Create the empty `src/features/scene/services/assets/` directory (`.gitkeep`).
6. Create `src/core/scene/sceneMachine.ts` — XState v5 stub machine:
   - States: `loading`, `playing`, `revealing` (with `objectId`), `paused` (with `resumeTo`).
   - Events (XState `type`): `start`, `interact`, `pause_toggle`, `entered_proximity { objectId }`, `exited_proximity { objectId }`.
   - Transitions (full, defined for every (state, event) pair the machine receives):
     - `loading + start → playing`. Other events in `loading` are no-ops.
     - `playing + entered_proximity { id } → revealing { objectId: id }`.
     - `playing + exited_proximity → playing` (no-op; we're not showing anything).
     - `playing + pause_toggle → paused { resumeTo: { kind: 'playing' } }`.
     - `playing + interact → playing` (no-op in foundations; the widget may `console.log('interact')` for demo verification).
     - `revealing { currentId } + entered_proximity { newId } → revealing { objectId: newId }` — **newest wins**, even if `newId !== currentId`. If `newId === currentId`, the transition is a self-loop (idempotent).
     - `revealing { currentId } + exited_proximity { exitedId } → playing` iff `exitedId === currentId`. If `exitedId !== currentId`, the event is a no-op (we're showing someone else; that other id's exit doesn't matter).
     - `revealing { currentId } + pause_toggle → paused { resumeTo: { kind: 'revealing'; objectId: currentId } }`.
     - `revealing + interact → revealing` (no-op in foundations).
     - `paused { resumeTo } + pause_toggle → resumeTo` (restore the held variant).
     - `paused + entered_proximity / exited_proximity / interact / start → paused` (no-ops).
   - Pure — no React, no R3F, no three imports. The machine's input/output types map to/from `features/scene/types/` via the widget.
   - Unit tests on the pure machine (no React). Cover every (state, event) pair above, plus the foundations-specific edge cases: re-entering the same `objectId` while in `revealing` (idempotent); exiting an unrelated id while revealing (no-op); resume from `paused` returns to the exact prior variant including `objectId`.
7. Create every component in `src/features/scene/components/Scene/`. Placeholder geometry only — a sphere for the player, primitive cubes for companies. Smoke render-test for `Scene` (no canvas, mocked R3F — verify component mounts and the discriminated `SceneState` props don't crash).
8. Create `src/features/scene/widget/scene/useScene.ts` and `SceneWidget.tsx`:
   - The ONE `useEffect`: subscribe to `subscribeToKeyboard`, route `intent_down`/`intent_up` to a Ref-backed `Set<Intent['kind']>`, route `command` to the machine actor.
   - Translate domain `kind` → XState `type` at the actor's `send` boundary.
   - On mount, send `{ type: 'start' }` to the machine.
   - Wrap `onEvent` (the Scene → machine bridge) in `useCallback` for stability.
   - Expose `{ state, actions }` if `actions` are needed externally; foundations may export `{ state }` only.
9. Wire `<SceneWidget />` into `src/routes/index.tsx` (replacing the placeholder text).
10. `pnpm check` green (typecheck + oxlint + suppressor scan + vitest).
11. `pnpm dev` shows a sphere flying around a constellation of placeholder cubes when you press WASD/arrows; proximity entries/exits fire as `console.log` events; `Escape` toggles pause; `E` fires a console.log for interact.

**Out of scope (explicitly):**

- Real XState machine internals beyond the stub above (no guards, no entry actions, no compound states).
- Real keyboard adapter polish — no focus management, no IME, no remap config.
- Real GLB asset loading — `services/assets/` exists empty.
- Aesthetics, materials, shaders, post-processing.
- The reveal-UI overlay content — proximity events fire but render nothing.
- Camera transitions between states.
- Touch / mobile input.

The output is a minimal flying-sphere demo with the **full port shape implemented end-to-end** and the layer boundaries enforced. The visual is throwaway; the architecture is permanent.

---

## Foundations kickoff prompt

Paste into a fresh session at `/Users/golan/Documents/repos/interactive-resume`:

> Build the 3D renderer foundations.
>
> **Source of truth:**
>
> - `docs/superpowers/specs/2026-05-19-3d-renderer-design.md` — the design (THIS file).
> - `docs/superpowers/specs/2026-05-19-3d-foundations-bdd.md` — port-targeted Gherkin scenarios.
> - `docs/superpowers/specs/2026-05-19-3d-foundations-tdd.md` — TDD bullets, organized by test-file path.
> - `CLAUDE.md` — Iron Laws (non-negotiable).
>
> **Scope:** strictly the "Foundations scope (next session)" section of the spec. Everything in its "Out of scope (explicitly)" sub-section is off limits. If a task tempts you across that line, stop and surface it — don't paper over.
>
> **Definition of done:**
>
> - `pnpm install` clean.
> - `pnpm dev` shows a sphere flying around placeholder company cubes; WASD/arrows move it; proximity entries/exits fire as `console.log`; `Escape` toggles pause; `E` fires interact.
> - `pnpm check` green.
> - Folder shape matches the spec's "Folder shape" section exactly.
> - Port surface matches the spec's "Port shape" section exactly. Discriminated unions only; branded `CompanyId`; no optionals acting as flags. `Intent` variants are atomic (no nested `axis`/`direction`). `paused` carries `resumeTo` on the variant.
> - Only `src/features/scene/widget/scene/**` and `src/features/scene/components/Scene/**` import `three`, `@react-three/fiber`, or `@react-three/drei`. `src/core/**` and `src/features/scene/services/{renderer,input}/**` import none of them. Verify with grep.
> - `asCompanyId` appears in exactly one source location (`types/company.ts`). The `as CompanyId` cast appears nowhere else.
>
> **Non-negotiable constraints (from CLAUDE.md):**
>
> - Hexagonal: no information leaks across layer boundaries.
> - Discriminated unions for every state, intent, event, command. No optional flags. No "should never happen" branches.
> - No type-system suppressors: no `!`, no `as any`, no `as unknown as T`, no `??` on lookup results, no `@ts-*` comments, no `eslint-disable` / `oxlint-disable` comments. Lint or tsc firing means the type is wrong — fix the type, not the symptom.
> - No `useEffect` outside `widget/scene/useScene.ts`.
> - `services/renderer/` and `services/input/` are React-free and three-free. Plain-record signatures in renderer math.
> - The XState machine lives in `src/core/scene/sceneMachine.ts` — pure. `kind → type` translation happens only at the widget's `actor.send` boundary.
>
> **Pipeline (per CLAUDE.md "Agent Orchestration", Full UI Feature minus styling):**
>
> 1. `bdd-tdd-spec-writer`
> 2. `core-architecture-guardian` (plan)
> 3. `state-machine-agent` (stub machine)
> 4. `data-adapter-builder` (keyboard intent stream + renderer math services)
> 5. `ui-component-builder` (Scene + children)
> 6. `feature-wiring` (composition root)
> 7. `route-url-adapter` (wire into `index.tsx`)
> 8. `core-architecture-guardian` (code mode)
> 9. `rules-guardian`
>
> Skip `styles-motion` (placeholder geometry only this session). Skip `prompt-optimizer` (this prompt is concrete).
>
> Start by reading the spec end-to-end and `CLAUDE.md` end-to-end. Confirm scope before launching the first agent.

---

## Deferred to subsequent sessions

- Real XState machine — full transitions, guards, entry actions.
- Real keyboard adapter — focus management, key-remap config, IME safety.
- GLB asset loading — Kenney + Quaternius integration via `services/assets/`.
- Aesthetic: skybox, materials, particles, shaders.
- Post-processing: bloom / fog / DoF (`@react-three/postprocessing`).
- 3D text strategy: drei `<Text>` SDF vs `<Html>` overlay vs mesh text — port supports any; pick after aesthetic lands.
- Reveal UX: tooltip layout, animation, dismiss flow.
- Mobile / touch input.
- Deployment target.
