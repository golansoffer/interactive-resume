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
// src/features/scene/types/scene-state.ts
type SceneState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'playing' }
  | { readonly kind: 'revealing'; readonly objectId: CompanyId }
  | { readonly kind: 'paused' };

// src/features/scene/types/intent.ts
type Intent =
  | { readonly kind: 'thrust'; readonly axis: 'forward' | 'backward' }
  | { readonly kind: 'turn'; readonly direction: 'left' | 'right' }
  | { readonly kind: 'brake' }
  | { readonly kind: 'interact' };

// Pull-based stream — sampled per frame inside useFrame.
// Not a 60Hz prop diff. This is the load-bearing decision that keeps React quiet during play.
type IntentStream = { readonly current: ReadonlySet<Intent['kind']> };

// src/features/scene/types/scene-event.ts
type SceneEvent =
  | { readonly kind: 'entered_proximity'; readonly objectId: CompanyId }
  | { readonly kind: 'exited_proximity'; readonly objectId: CompanyId }
  | { readonly kind: 'interact_pressed' };

// src/features/scene/types/company.ts
type CompanyId = string & { readonly __brand: 'CompanyId' };

type Company = {
  readonly id: CompanyId;
  readonly position: readonly [number, number, number];
};

// Inbound port: the props Scene.tsx accepts from the widget.
type SceneProps = {
  readonly state: SceneState;
  readonly companies: ReadonlyArray<Company>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
};
```

**Three decoupled layers inside the widget:**

1. **Outside `<Canvas>`** — React + XState. Discrete state changes only (tens per session).
2. **R3F reconciliation** — fires only on `SceneState` transitions. Not at 60Hz.
3. **`useFrame`** — continuous integration. Reads `intents.current` (Ref-backed). Mutates three.js objects directly via refs. Computes proximity. Calls `onEvent` on transitions only.

`Vector3` positions and three.js objects are **internal** to the renderer service and R3F children. They never appear in the inbound or outbound port types.

---

## Folder shape

```
src/features/scene/
├── types/
│   ├── scene-state.ts
│   ├── intent.ts
│   ├── scene-event.ts
│   └── company.ts
├── services/
│   ├── renderer/                — pure math. No React, no three.js types in signatures.
│   │   ├── integrateMotion.ts
│   │   ├── proximityCheck.ts
│   │   └── clampToBounds.ts
│   └── assets/                  — created empty (.gitkeep). Populated when GLB loading lands.
├── components/
│   └── Scene/
│       ├── Scene.tsx            — top-level <Canvas> child. Pure renderer.
│       ├── Player.tsx           — useFrame integration via Ref.
│       ├── Companies.tsx        — renders all company markers.
│       ├── FollowCamera.tsx
│       ├── ProximityWatcher.tsx — useFrame; calls onEvent on transition.
│       └── RevealOverlay.tsx    — drei <Html>. Renders nothing in foundations.
└── widget/
    └── scene/
        ├── useScene.ts          — composition root. The ONE useEffect.
        └── SceneWidget.tsx      — thin shell. Mounts <Canvas>. Renders <Scene />.
```

Allowed importers of `three` / `@react-three/fiber` / `@react-three/drei`:

- `features/scene/widget/scene/**`
- `features/scene/components/Scene/**`
- `features/scene/services/assets/**` (when populated, for `GLTFLoader` only)

Anywhere else is a violation. Verifiable by grep.

The `services/renderer/` math modules take plain records (`{ x: number; y: number; z: number }`), not `Vector3`. They are unit-testable with no three.js dependency.

`schema/` and `api/` are not present yet — there is no external data in foundations. They will arrive when real resume data is wired.

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

Plumbing (lands when models are wired, **not** in foundations):

- `.glb` files live in `public/models/<pack>/`.
- The asset service exposes a typed loader. Likely shape: a thin wrapper around three.js `GLTFLoader` returning `Promise<Object3D>`, with R3F suspense integration consumed inside `components/Scene/`. Exact layer ownership locked at that time so `services/` stays React-free per CLAUDE.md.
- Foundations creates the empty `services/assets/` directory with a `.gitkeep`. That's it.

---

## Iron-Law verification

| Law | How it's met |
|---|---|
| **1 Hexagonal** | Nothing outside the three allowed locations imports `three`, `@react-three/fiber`, or `@react-three/drei`. Grep-verifiable. |
| **2 Discriminated unions** | `SceneState`, `Intent`, `SceneEvent`, asset-load state — all tagged. Kinematic state (`Vector3`) is internal to renderer + R3F components; never crosses a port. |
| **3 Illegal states unrepresentable** | `CompanyId` is a branded type derived from the input list — proximity events for unknown ids cannot be constructed. `revealing` carries its `objectId` on the variant; never optional. Asset-load uses discriminated states, no optional fields as flags. |
| **4 Design discipline** | One widget, one canvas, one frame-loop, one event channel out. `IntentStream` is a Ref-pull, not a 60Hz prop diff — the module-deepening choice instead of bundling per-key props or dispatching 60Hz events. |

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

1. Install dependencies: `pnpm add three @react-three/fiber @react-three/drei` + `pnpm add -D @types/three`.
2. Create every type file in `src/features/scene/types/` per [§ Port shape](#port-shape). Discriminated unions only. Branded `CompanyId`.
3. Create `src/features/scene/services/renderer/` with three pure math modules (`integrateMotion`, `proximityCheck`, `clampToBounds`). Plain-record signatures (no three.js types). Unit-test coverage for each.
4. Create the empty `src/features/scene/services/assets/` directory (`.gitkeep`).
5. Create every component in `src/features/scene/components/Scene/`. Placeholder geometry only — a sphere for the player, primitive cubes for companies. No GLB loading.
6. Create `src/features/scene/widget/scene/useScene.ts` and `SceneWidget.tsx`:
   - Stub XState machine: `loading → playing` on mount; `playing ↔ revealing { objectId }` on proximity events; `paused` on a key (e.g. Escape) toggle.
   - Stub keyboard adapter: WASD + arrows → `IntentStream` (Ref-backed `Set<Intent['kind']>`). The composition root is the **one** place a `useEffect` is allowed.
7. Wire `<SceneWidget />` into `src/routes/index.tsx` (replacing the placeholder text).
8. `pnpm check` green (typecheck + oxlint + suppressor scan + vitest).
9. `pnpm dev` shows a sphere flying around a constellation of placeholder cubes when you press WASD/arrows; proximity entries/exits fire as `console.log` events.

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
> - `docs/superpowers/specs/2026-05-19-3d-renderer-design.md` — the design.
> - `CLAUDE.md` — Iron Laws (non-negotiable).
>
> **Scope:** strictly the "Foundations scope (next session)" section of the spec. Everything in its "Out of scope (explicitly)" sub-section is off limits. If a task tempts you across that line, stop and surface it — don't paper over.
>
> **Definition of done:**
>
> - `pnpm install` clean.
> - `pnpm dev` shows a sphere flying around placeholder company cubes; WASD/arrows move it; proximity entries/exits fire as `console.log`.
> - `pnpm check` green.
> - Folder shape matches the spec's "Folder shape" section exactly.
> - Port surface matches the spec's "Port shape" section exactly. Discriminated unions only; branded `CompanyId`; no optionals acting as flags.
> - Only `features/scene/widget/scene/**` and `features/scene/components/Scene/**` import `three`, `@react-three/fiber`, or `@react-three/drei`. Verify with grep.
>
> **Non-negotiable constraints (from CLAUDE.md):**
>
> - Hexagonal: no information leaks across layer boundaries.
> - Discriminated unions for every state, intent, event, command. No optional flags. No "should never happen" branches.
> - No type-system suppressors: no `!`, no `as any`, no `as unknown as T`, no `??` on lookup results, no `@ts-*` comments, no `eslint-disable` / `oxlint-disable` comments. Lint or tsc firing means the type is wrong — fix the type, not the symptom.
> - No `useEffect` outside `widget/scene/useScene.ts`.
> - `services/renderer/` math modules are pure and take plain records — no three.js types in signatures.
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
