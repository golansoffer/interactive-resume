# Progress Indicator — Design

**Date:** 2026-05-22
**Scope:** Add a slim, left-edge, vertically-centered HUD card that surfaces the player's exploration progress through the five career planets. The card is always visible during active scene states, uses live planet-avatar renders (same primitive as the company-info-card hero) for both the headline and the per-planet pip column, and plays a gentle dopamine choreography (pip burst + ripples + counter flip + card-border swell) on each first visit, with a green variant on route-complete. Out-of-order visits are first-class — every state is per-planet, never "progress along a contiguous line."

---

## Goal

The 3D scene already tracks visited planets (in `sceneMachine.context.visited`) and projects route status (`projectRoute` → `pre_route | mid_route | complete`). What is missing is a visible, always-on HUD surface that lets the player:

1. **See what they've explored.** A per-planet visited/here/unvisited indicator that holds true regardless of visit order.
2. **See what's left.** A live counter `NN / 05` and a 5-pip column with dim/lit states.
3. **See where they are.** A headline planet that shows the active proximity, the last-departed anchor, or an empty placeholder before the first visit.
4. **Get a dopamine reward on every visit.** A choreographed moment — pip wake → 3 ripples → counter flip → card-border swell — that scales up to a green completion ceremony when the fifth planet is visited.
5. **Stay aligned with the existing AAA cockpit aesthetic.** Same chrome (`bg-card/85`, `backdrop-blur-md`, `ring-foreground/10`, `shadow-2xl`), same cyan accent (`#5fd6ff`), same `Geist Mono` for monospaced callsigns, same per-section staggered entry.

## Non-goals

- **No new core state.** `sceneMachine` already has the data — visited tracking, scene state, proximity events. The progress feature is a pure projection + UI; no FSM, no event sourcing, no new core domain.
- **No "directional" hint.** The WaypointBeam in 3D already nav-hints toward the next unvisited. The card does not duplicate this — it is anchor-first, not target-first. (Alternative considered: "nearest unvisited as headline." Rejected because it competes with the in-world beam and erases the just-explored memory the moment the player leaves proximity.)
- **No sound in this spec.** Audio service exists and a "visit tick + completion swell" pair is plausible — flagged as follow-up.
- **No achievement persistence.** Visited is in-memory (sceneMachine context). Refresh resets. The user can revisit this later if persistence becomes a goal.
- **No URL state.** Progress is a derived view of `(state, visited, route)`. The route is the source of canonical ordering; visited is the source of which-have-been-touched.
- **No per-planet metadata in the card body.** The component shows planet, short code, status, count, pips — and no dates, role, or hook. Those live in the InfoPanel.
- **No collapsed / minimized state.** The card is always at full size when visible; visibility is binary (`visible | hidden`) following the same rule as the comms dock.

---

## Architecture

### Layer placement

New vertical-slice feature `features/progress/`, mirroring the shape of the existing features (`features/comms/`, `features/audio/`, `features/scene/`, `features/ships/`).

```
features/progress/
├── types/
│   ├── short-code.ts               — branded ShortCode + map CompanyId → ShortCode
│   ├── progress-projection.ts      — ProgressProjection discriminated union
│   ├── headline.ts                 — Headline discriminated union
│   ├── pip.ts                      — Pip discriminated union
│   ├── status-label.ts             — StatusLabel discriminated union
│   ├── counter.ts                  — Counter discriminated union
│   ├── visit-event.ts              — VisitEvent discriminated union (for choreography triggers)
│   └── motion-preference.ts        — re-export or import from features/comms (same shape)
├── components/
│   └── ProgressCard/
│       ├── ProgressCard.tsx        — pure shell (props in, no events out)
│       ├── ProgressCard.test.tsx
│       ├── HeadlinePlanet.tsx      — large planet avatar (52px); thin wrapper around the planet primitive
│       ├── HeadlinePlanet.test.tsx
│       ├── ProgressPip.tsx         — 16px planet pip
│       ├── ProgressPip.test.tsx
│       ├── ProgressCounter.tsx     — "NN / 05 SYSTEMS" with flip animation slot
│       ├── ProgressCounter.test.tsx
│       └── StatusLabel.tsx         — uppercase status word ("ACTIVE", "LAST EXPLORED", etc.)
└── widget/
    └── card/
        ├── ProgressCardWidget.tsx  — thin shell composing useProgress + ProgressCard
        ├── useProgress.ts          — projects (sceneState, visited, route, motion) → ProgressProjection + VisitEventStream
        ├── useProgress.test.ts
        ├── projectProgress.ts      — pure (sceneState, visited, route) → ProgressProjection
        ├── projectProgress.test.ts
        ├── detectVisitEvents.ts    — pure (prevProjection, nextProjection) → VisitEvent | null
        ├── detectVisitEvents.test.ts
        ├── projectVisibility.ts    — pure SceneState → Visibility (mirrors projectDockVisibility)
        ├── projectVisibility.test.ts
        ├── shortCodes.ts           — CompanyId → ShortCode lookup table
        └── shortCodes.test.ts
```

Touch points outside the new feature:

```
features/scene/widget/scene/SceneWidget.tsx
  — mounts <ProgressCardWidget /> alongside <CommsDockWidget /> and <AudioControlsWidget />
  — passes sceneState, visited, motion

features/scene/widget/scene/useScene.ts
  — exposes visited (already in sceneMachine context, currently only used by projectRoute)
  — getVisited(snapshot) becomes part of the return value
```

No `core/` addition. No new state machine. No new schema (zod). No new route. No URL state.

### Dependency rule

```
SceneWidget → ProgressCardWidget → useProgress (pure projection on each render)
                                 → ProgressCard (pure UI)
                                   → HeadlinePlanet, ProgressPip, ProgressCounter, StatusLabel

useProgress → projectProgress(state, visited, route)
            → detectVisitEvents(prevProjection, currentProjection)
            → projectVisibility(state)
            → subscribeToReducedMotion (existing service, reused from features/comms)
```

Cross-feature traffic flows only through declared ports:
- `SceneState` (existing, from features/scene/types/scene-state.ts)
- `CompanyId`, `CompanyEntry`, `PlanetAssetId` (existing, from features/scene/types/)
- `CAREER_ROUTE` (existing, from features/scene/widget/scene/companies.ts)
- `MotionPreference` (existing, from features/comms/types/motion-preference.ts — or imported via shared service)

The progress feature never reaches into the comms feature's internals, the audio feature's internals, or react-three-fiber. The components never see the scene state machine — they see only parsed projections.

### Domain types

```typescript
// features/progress/types/short-code.ts
export type ShortCode = string & { readonly __brand: 'ShortCode' };
export const asShortCode = (raw: string): ShortCode => raw as ShortCode;

// features/progress/widget/card/shortCodes.ts
export const COMPANY_SHORT_CODES: Readonly<Record<CompanyId, ShortCode>>;
//   mave           → MAV
//   8fig           → 8FG
//   riverside      → RVS
//   streamelements → STE
//   tgs            → TGS

// features/progress/types/headline.ts
type HeadlineCompany = {
  readonly id: CompanyId;
  readonly assetId: PlanetAssetId;
  readonly shortCode: ShortCode;
};

export type Headline =
  | { readonly kind: 'empty' }                                                // pre-route
  | { readonly kind: 'anchor';   readonly company: HeadlineCompany }          // free-roaming, last visited
  | { readonly kind: 'active';   readonly company: HeadlineCompany }          // in proximity
  | { readonly kind: 'complete'; readonly company: HeadlineCompany };         // route done

// features/progress/types/pip.ts
export type Pip =
  | { readonly kind: 'unvisited'; readonly companyId: CompanyId; readonly assetId: PlanetAssetId }
  | { readonly kind: 'visited';   readonly companyId: CompanyId; readonly assetId: PlanetAssetId }
  | { readonly kind: 'here';      readonly companyId: CompanyId; readonly assetId: PlanetAssetId };

// features/progress/types/status-label.ts
export type StatusLabel =
  | { readonly kind: 'standby' }
  | { readonly kind: 'active' }
  | { readonly kind: 'last_explored' }
  | { readonly kind: 'route_complete' };

// features/progress/types/counter.ts
export type Counter =
  | { readonly kind: 'idle';     readonly visited: number; readonly total: number }   // pre/mid
  | { readonly kind: 'complete'; readonly total: number };

// features/progress/types/progress-projection.ts
export type ProgressProjection = {
  readonly headline: Headline;
  readonly status:   StatusLabel;
  readonly counter:  Counter;
  readonly pips:     readonly [Pip, Pip, Pip, Pip, Pip];          // tuple — exactly 5 in canonical career order
};

// features/progress/types/visit-event.ts
export type VisitEvent =
  | { readonly kind: 'first_visit'; readonly companyId: CompanyId; readonly assetId: PlanetAssetId; readonly completesRoute: boolean }
  | { readonly kind: 'revisit';     readonly companyId: CompanyId; readonly assetId: PlanetAssetId }
  | { readonly kind: 'depart';      readonly companyId: CompanyId; readonly assetId: PlanetAssetId };
```

The projection is a **discriminated union of value-bearing fields**, not a soup of optionals. Every illegal state is forbidden by construction:
- `headline.kind === 'empty'` implies `status.kind === 'standby'` and `counter.visited === 0`.
- `headline.kind === 'complete'` implies `counter.kind === 'complete'` and every pip is `visited` (except the just-arrived one which is `here`).
- A `Pip` can never be both "visited" and "unvisited" (no `visited?: boolean` field).
- `pips` is a 5-tuple, not `ReadonlyArray<Pip>` — the type itself carries the proof that there are exactly 5 entries, in canonical career order.

### Visibility port

Mirrors `features/comms/widget/dock/projectDockVisibility.ts` exactly — `playing | revealing | paused` → visible; `loading` → hidden.

---

## Behavior

### Projection rules

`projectProgress(state: SceneState, visited: ReadonlyArray<CompanyId>, route: Route): ProgressProjection`

The function is pure. It is given the canonical career order (route), the dedup'd visit-time-ordered visited array, and the current scene state. It returns the projection.

#### Headline

| Scene state            | Visit history      | Headline                                                      |
|------------------------|--------------------|---------------------------------------------------------------|
| `revealing(id)`        | any                | `{ kind: 'active',   company: lookup(id) }`                   |
| `paused → resumeTo revealing(id)` | any     | `{ kind: 'active',   company: lookup(id) }`                   |
| `playing`              | empty              | `{ kind: 'empty' }`                                           |
| `playing`              | non-empty, partial | `{ kind: 'anchor',   company: lookup(last(visited)) }`        |
| `playing`              | all 5 visited      | `{ kind: 'complete', company: lookup(last(visited)) }`        |
| `paused → resumeTo playing` | (same as playing branches)                                                            |
| `loading`              | empty              | (visibility hidden — projection still well-defined but unused) |

The `lookup(id)` is a guaranteed-total map from `CompanyId` to `HeadlineCompany` because every `CompanyId` in `visited` came from `entered_proximity` events whose payload is parsed against `CAREER_ROUTE`. No "should never happen" branch needed.

#### Status

| Headline kind    | Status                          |
|------------------|---------------------------------|
| `empty`          | `{ kind: 'standby' }`           |
| `active`         | `{ kind: 'active' }`            |
| `anchor`         | `{ kind: 'last_explored' }`     |
| `complete`       | `{ kind: 'route_complete' }`    |

Display strings (rendered by `StatusLabel`, in `Geist Mono` 7px / 0.22em):
- `standby` → "STANDBY"
- `active` → "ACTIVE"
- `last_explored` → "LAST EXPLORED"
- `route_complete` → "ROUTE COMPLETE"

#### Counter

```
counter.kind = (visited.length === total) ? 'complete' : 'idle'
counter.visited = visited.length   (when idle)
counter.total = 5
```

Display: `NN / 05` where NN is zero-padded. When `kind === 'complete'`, both numbers render in the success color.

#### Pips

For each entry in canonical `CAREER_ROUTE` (Mave → 8fig → Riverside → StreamElements → TGS, top to bottom in the column):

```
if (revealing && state.objectId === entry.id)          → { kind: 'here',      companyId, assetId }
else if (visited.includes(entry.id))                   → { kind: 'visited',   companyId, assetId }
else                                                   → { kind: 'unvisited', companyId, assetId }
```

The pip is `here` only during `revealing` (and the resumeTo-revealing branch of paused). Once the player exits proximity (back to `playing`), the formerly-here pip becomes `visited`.

### Visit event detection

`detectVisitEvents(prev: ProgressProjection, next: ProgressProjection): VisitEvent | null`

Pure diff:

- Any pip went from `unvisited` → `here` → `first_visit { completesRoute: next.counter.kind === 'complete' }`.
- Any pip went from `visited` → `here` → `revisit`.
- Any pip went from `here` → `visited` → `depart`.
- Otherwise → `null`.

(Note: the sceneMachine emits `entered_proximity` once per crossing — by the time the projection is recomputed, the visited array and the `revealing` state are updated together in the same event-handling tick. There is no rendering frame in which a pip jumps `unvisited` → `visited` skipping `here`.)

Only one event per render tick (the projection only ever transitions one pip per tick). The widget drives the animation off whichever event fires.

### Animation choreography

All durations and easings are codified in the component as motion tokens. Component honors `MotionPreference`:
- `MotionPreference = { kind: 'normal' }` → full choreography.
- `MotionPreference = { kind: 'reduced' }` → final state applied instantly; no cross-fade, no ripple, no scale, no border swell.

#### Scene A — first visit (regular)

Triggered by `VisitEvent { kind: 'first_visit', completesRoute: false }`.

| T (ms)   | What                                                                                                                                       |
|----------|--------------------------------------------------------------------------------------------------------------------------------------------|
| **0**    | Headline cross-fade STE → new planet begins (300ms ease-out). Pip starts waking (color sweep). Status flips `last_explored → active`. Card border begins to tint cyan; outer halo emits. |
| **300**  | Pip scales 1.0 → 1.18 (ease-out). Three concentric ripple rings emit outward (staggered 0/100/200ms, 800ms total). Counter rolls `NN → NN+1` with a brief text-shadow glow (200ms). **Card border at peak cyan brightness; outer halo at maximum spread (~22px).** |
| **600**  | Pip eases back to scale 1.0 with `here` glow held. Ripples dissolve outward (small ring already gone, big still fading). Counter steady at the new value. **Card border begins softening; halo contracting.** |
| **900**  | All ripples gone. Card at proximity steady state with pip `here`.                                                                          |
| **1100** | **Card border fully back to base rest.** Reward window closes.                                                                              |

The card-border swell is a **single, gentle, smooth cyan rise-and-fall** over the full window. It uses:
- `border-color`: rest `rgba(230, 234, 242, 0.10)` → peak `#5fd6ff` → rest.
- `box-shadow`: layered — keeps the base `0 8px 32px rgba(0,0,0,0.45)` and adds `0 0 0 1.5px rgba(95,214,255,0.18), 0 0 22px rgba(95,214,255,0.24), 0 0 60px rgba(95,214,255,0.10)` at peak, both fade to 0 at end.

Headline cross-fade uses `transition: opacity 0.3s ease, filter 0.3s ease`. During the fade, the outgoing planet does NOT scale, NOT translate — it simply yields to the incoming one with a brief brightness lift in the middle.

#### Scene B — first visit, completes route

Triggered by `VisitEvent { kind: 'first_visit', completesRoute: true }`.

| T (ms)   | What (cyan beat, same as Scene A first 600ms)                              |
|----------|----------------------------------------------------------------------------|
| **0**    | Same as Scene A T=0.                                                        |
| **300**  | Same as Scene A T=300 — cyan pip peak + ripples + counter flip + border peak. |

| T (ms)   | What (green takeover, additional)                                                                                                                              |
|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **600**  | Color shift across card: cyan → green for pip column glow, headline halo, counter text, status text, card border. 400ms linear cross-fade. Status text types in letter-by-letter from "ACTIVE" → "ROUTE COMPLETE" (one letter per 60ms, ~50ms cursor blink before settling). |
| **900**  | Card-border swell second pulse begins (green). Pip column emits a synchronized small ripple from each of the 5 pips (offset 0, 80, 160, 240, 320ms — staggered constellation). |
| **1200** | Green card halo expands beyond the card outline: `inset: -8px` ring at 0.25 opacity, then `inset: -22px` ring at 0.12 opacity, both fade to 0 over 600ms.       |
| **1500** | All transient animations have resolved. Card settles into a **persistent green-tinted state**: pip glow soft green, headline halo soft green, status "ROUTE COMPLETE" (green), counter "05 / 05" (green), card border in a low-amplitude breathing green tint that loops at ~6s period for the remainder of the session. |

The persistent breathing border is keyed off `counter.kind === 'complete'`, not off `headline.kind === 'complete'`. This matters when the player re-enters a planet's proximity after finishing the route: the projection's `headline` flips back to `active`, the `status` flips back to `active`, but the `counter` stays `complete` — so the card retains its breathing green border while the cyan active-state overlay rides on top (pip ring, headline halo). The route-complete signal persists; the active overlay is layered. It is the only continuous card-chrome animation; it is opt-out via `prefers-reduced-motion`.

#### Scene C — revisit

Triggered by `VisitEvent { kind: 'revisit' }`. Muted version:

- Headline cross-fade (300ms) ✓
- Pip glow shift from `visited` → `here` (300ms) ✓
- Status flip `last_explored → active` ✓
- **No counter tick.** Counter holds.
- **No pip scale pump, no ripples.**
- **No card-border swell.**

#### Scene D — exit proximity (depart)

Triggered by `VisitEvent { kind: 'depart' }`.

- Headline cross-fade (300ms) from the departed planet to the new anchor (which is the same planet, just shown without the `here` glow ring).
- Status flip `active → last_explored`.
- Pip glow shift from `here` → `visited` (matching dimming).
- No counter change.
- No card-border swell.

This is the inverse of the headline-only beats of Scene A.

#### Reduced motion

When `MotionPreference.kind === 'reduced'`:
- All `transition: …` rules become `transition: none` (matches the existing `data-motion=reduced` pattern in CommsDock and CompanyInfoPanel).
- All ripples are not rendered (the component returns `null` for the ripple elements when motion is reduced).
- The pip scale pump is suppressed.
- The card-border swell is suppressed (border stays at rest; counter still flips to new value, instantly).
- The persistent breathing-border on completion is suppressed (border stays at the green rest color).
- The letter-by-letter "ROUTE COMPLETE" type-in becomes an instant swap to the full string.

The visible *state change* still happens — what's removed is the transition between states. Information parity is preserved.

---

## Visual specification

### Card chrome

- Width: **84px**
- Min-height: **260px** (flex column; grows if a name wraps)
- Position: `fixed`, `top: 50%`, `left: 1.5rem`, `transform: translateY(-50%)`, `z-index: 40` (same band as CommsDock — both are persistent HUD)
- Background: `bg-card/85` (matches dock and info panel)
- Border: `1px solid` at rest, color tween between `rgba(230,234,242,0.10)` (rest) → `#5fd6ff` (peak) → rest
- Radius: `rounded-xl` (10px)
- Backdrop: `backdrop-blur-md`
- Shadow: `shadow-2xl`
- Padding: `0.85rem 0.6rem 0.7rem`
- Gap (internal): `0.5rem`

### Headline planet

- Size: **52px diameter** in the card
- Rendered by the same primitive as `features/scene/components/CompanyInfoPanel/PlanetPreview.tsx` — slow rotation, dressed materials, KEY+FILL lighting, `useGLTF` + `useTexture`
- The empty state (`Headline.kind === 'empty'`) renders a 52px dashed-circle placeholder (`border: 1.5px dashed rgba(230,234,242,0.22)`), no rotation, no Canvas

### Headline name (short code)

- Font: `Geist Mono Variable`
- Size: 13px
- Weight: 600
- Color: `#e6eaf2` (foreground)
- Letter-spacing: 0.14em
- Empty state: renders `—` in `rgba(230, 234, 242, 0.22)`

### Status label

- Font: `Geist Mono Variable`
- Size: 7px
- Weight: 500 (default)
- Letter-spacing: 0.22em
- Text-transform: uppercase
- Color:
  - `standby` → `rgba(230, 234, 242, 0.22)`
  - `active` / `last_explored` → `#5fd6ff`
  - `route_complete` → `#7be0a2`

### Rules (faint dividers)

Two horizontal rules, one above and one below the counter:

```
height: 1px
background: linear-gradient(90deg,
  transparent 0%,
  rgba(230,234,242,0.10) 25%,
  rgba(230,234,242,0.10) 75%,
  transparent 100%)
```

### Counter

- Font: `Geist Mono Variable`
- Size: 8.5px (separator/unit) and 10px (numbers)
- Weight: 600 (numbers), 500 (separator/unit)
- Letter-spacing: 0.14em
- Text-transform: uppercase
- Color:
  - Numbers in `idle` state: `#5fd6ff` (visited count), `rgba(230,234,242,0.55)` (total)
  - Numbers in `complete` state: both `#7be0a2`
- Format: `02 / 05` (or unit `SYSTEMS` appended at the right if width allows — open visual variant)

### Pip column

- 5 pips, vertical, centered horizontally in card
- Pip size: **16px diameter**
- Gap between pips: **8px**
- Order top-to-bottom: Mave (Saturn), 8fig (Jupiter), Riverside (Mars), StreamElements (Earth), TGS (Venus)
- Each pip is a planet primitive — same renderer as headline, but smaller and (decision: see "Performance & rendering" below) potentially using a baked thumbnail to avoid 6 live Canvases

### Pip visual states

| State       | Filter / opacity                                              | Glow                                                                                       |
|-------------|---------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| `unvisited` | `grayscale(1) brightness(0.45) contrast(0.85)`, opacity `0.4` | none                                                                                       |
| `visited`   | full color, no filter, opacity 1                              | none (clean)                                                                               |
| `here`      | full color                                                    | `0 0 0 1.5px rgba(95,214,255,0.18), 0 0 8px #5fd6ff, 0 0 16px rgba(95,214,255,0.18)`       |

### Ripples (Scene A T+300 to T+900)

Three concentric rings, all centered on the firing pip:

```
.ripple       { inset: -3px;  border: 1.5px solid #5fd6ff;        opacity: 0.60; }
.ripple-big   { inset: -12px; border: 1px solid #5fd6ff;          opacity: 0.35; }
.ripple-huge  { inset: -22px; border: 1px solid #5fd6ff;          opacity: 0.20; }
```

Each fades to 0 over 800ms total, staggered start (0 / 100ms / 200ms). All three borders are `border-radius: 50%`.

### Card-border swell (Scene A and B)

Three keyframe stops:

```
rest      { border-color: rgba(230,234,242,0.10); box-shadow: 0 8px 32px rgba(0,0,0,0.45); }
rising    { border-color: rgba(95,214,255,0.35);  box-shadow: 0 8px 32px rgba(0,0,0,0.45),
                                                                0 0 0 1px rgba(95,214,255,0.12),
                                                                0 0 14px rgba(95,214,255,0.12); }
peak      { border-color: #5fd6ff;                 box-shadow: 0 8px 32px rgba(0,0,0,0.45),
                                                                0 0 0 1.5px rgba(95,214,255,0.18),
                                                                0 0 22px rgba(95,214,255,0.24),
                                                                0 0 60px rgba(95,214,255,0.10); }
falling   { border-color: rgba(95,214,255,0.22);  box-shadow: 0 8px 32px rgba(0,0,0,0.45),
                                                                0 0 0 1px rgba(95,214,255,0.08),
                                                                0 0 16px rgba(95,214,255,0.06); }
```

Timing: `rest → rising` (0–300ms ease-out), `rising → peak` (300–500ms ease-out), `peak → falling` (500–900ms ease-in-out), `falling → rest` (900–1100ms ease-in).

The green variant of the swell uses `#7be0a2` and `rgba(123, 224, 162, …)` in place of the cyan values.

### Persistent breathing border (complete state)

After Scene B settles:

```
animation: breathe 6s ease-in-out infinite;
@keyframes breathe {
  0%, 100% { border-color: rgba(123,224,162,0.18); box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 14px rgba(123,224,162,0.06); }
  50%      { border-color: rgba(123,224,162,0.45); box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 22px rgba(123,224,162,0.14); }
}
@media (prefers-reduced-motion: reduce) {
  animation: none;
  border-color: rgba(123,224,162,0.22);
}
```

---

## Performance & rendering

The headline and the 5 pips together are **6 planet avatars on screen at once**. Naively wrapping each in its own `<Canvas>` (the way `PlanetPreview.tsx` does today) would mount 6 R3F renderers. That is wasteful and may cause framerate dips, especially on the dopamine moment when the scene Canvas is also pushing updates.

**Two viable strategies — decision deferred to the implementation plan:**

**Strategy A — Shared progress-card Canvas.** A single `<Canvas>` inside the progress card with 6 `<group>` children at fixed positions: 1 large (headline) at the top, 5 small in a vertical column below. The Canvas is `dpr={[1, 2]}` with `frameloop="demand"` plus invalidation triggered on every projection change. One renderer, one composite layout.

- **Pro:** one R3F instance, predictable cost, planets share lighting setup.
- **Con:** the headline must visually live within the card chrome (HTML), but the planets live in WebGL. Need to either use drei's `<Html>` to overlay the HTML chrome on top of the Canvas, or split the card into a Canvas-zone + an HTML-zone with a fixed layout. The latter is straightforward; just a vertical flex stack with the Canvas at top, HTML rest below.

**Strategy B — Live headline + baked pip thumbnails.** Render only the headline (52px) as a live R3F Canvas. Bake the 5 pip thumbnails to PNG (32px × 32px each, generated at build time or from a one-time render-to-texture) and use `<img>` for the pip column. The pip states (filter / opacity / glow) all apply cleanly to `<img>`.

- **Pro:** simplest by far. Only 1 Canvas for the whole card. No WebGL state for 5 static pips.
- **Pro:** pip thumbnails are tiny, can be retina-doubled (64px) cheap.
- **Con:** unvisited→visited→here state changes only update filter/opacity/glow, not motion (pips don't rotate). But: a 16px pip can't really show rotation anyway; the planet identity is in the silhouette/color.
- **Con:** Saturn's rings depend on rendering angle. Need a single canonical thumbnail per planet — fine.

**Recommendation:** **Strategy B.** The pips don't need motion at 16px, and one Canvas per card matches the existing PlanetPreview cost. The pip "rotation" effect for visited planets in the AAA brief is satisfied by the headline; the pip column reads as a chart, not a constellation.

The thumbnails can either be:
- Pre-rendered PNG assets dropped into `public/icons/planets/` (matching the existing `public/icons/<company>.svg` convention) — generated once, manually or via a build script.
- Generated at runtime via a hidden off-screen Canvas — overkill for 5 static images.

The implementation plan picks one; this design accepts either.

### Frame budget

The headline Canvas runs the same primitive as `PlanetPreview.tsx`. Existing per-planet cost (info-card hero, single Canvas) is acceptable. The card adds:
- 1 R3F instance (headline planet).
- 5 `<img>` thumbnails (Strategy B) or 5 additional `<group>`s in the shared Canvas (Strategy A).
- HTML chrome — negligible.
- The dopamine choreography uses pure CSS transitions/keyframes, not requestAnimationFrame loops. Zero JS-driven animation cost.

---

## Touch points

| File                                              | Change                                                                               |
|---------------------------------------------------|--------------------------------------------------------------------------------------|
| `src/features/scene/widget/scene/SceneWidget.tsx` | Add `<ProgressCardWidget />` adjacent to `<CommsDockWidget />` and `<AudioControlsWidget />`. Pass `sceneState` and `visited`. |
| `src/features/scene/widget/scene/useScene.ts`     | Already exposes `state`; add `visited` to the return (currently consumed internally by `projectRoute`). |
| `src/core/scene/sceneMachine.ts`                  | No change. `getVisited(snapshot)` exists.                                            |
| `src/features/progress/**` (new)                  | All new files per the layer placement above.                                         |

No changes to: `core/`, comms feature, audio feature, ships feature, routes, schemas, the 3D scene rendering itself.

The progress card is rendered as a sibling of the dock, not nested inside it.

---

## Test strategy

Tests target ports, not implementation. Same shape as the existing comms tests.

### `projectProgress.test.ts` — pure projection

Cases (one assertion per scenario, against the projection shape):

- **State `loading`**, no visits → projection visibility hidden (caller handles); the projection itself is still well-defined (headline `empty`, status `standby`, counter `idle 0/5`, all pips `unvisited`).
- **State `playing`**, no visits → `headline.empty`, `status.standby`, `counter.idle 0/5`, all pips `unvisited`.
- **State `playing`**, visited `[mave]` → `headline.anchor (Mave)`, `status.last_explored`, `counter.idle 1/5`, pips `[visited, unvisited × 4]`.
- **State `revealing(8fig)`**, visited `[mave]` → `headline.active (8fig)`, `status.active`, `counter.idle 1/5`, pips `[visited, here, unvisited × 3]`.
- **State `revealing(8fig)`**, visited `[mave, 8fig]` (revisit) → same projection as above but pips shows the 8fig as `here` (not `visited` — `here` wins).
- **State `playing`**, visited `[mave, 8fig]` → `headline.anchor (8fig)` (last-visited), pips `[visited, visited, unvisited × 3]`.
- **State `playing`**, visited all 5 → `headline.complete (lastVisited)`, `status.route_complete`, `counter.complete 5`, all pips `visited`.
- **State `revealing(tgs)`**, visited `[mave, 8fig, riverside, streamelements]` (about to complete) → `headline.active (tgs)`, `status.active`, `counter.idle 4/5` (counter has NOT ticked yet; this is the pre-event state of "about to complete"). The actual transition to complete happens on the next state's projection.
- **State `paused → resumeTo revealing(riverside)`** → same projection as `revealing(riverside)`.
- **State `paused → resumeTo playing`** → same projection as `playing` with the same visited.
- **Pip ordering** — for any visited subset, the projection's `pips` tuple is always indexed by canonical career order (Mave first, TGS last). Visit order does NOT reorder.

### `detectVisitEvents.test.ts` — pure diff

- prev all-unvisited, next has one `here` → `{ kind: 'first_visit', completesRoute: false }`.
- prev has one `here`, next has same pip `visited` (player exited proximity) → `{ kind: 'depart' }`.
- prev has one `here`, next has different pip `here` (player went straight from one to another) → multiple events? — DESIGN DECISION: emit a single `first_visit` for the new pip; the depart of the previous is implied. Tested as such.
- prev = next → `null`.
- prev 4/5 visited and one `unvisited`, next has that unvisited as `here` → `{ kind: 'first_visit', completesRoute: true }`.
- prev has a pip `visited`, next has same pip `here` → `{ kind: 'revisit' }`.

### `shortCodes.test.ts`

- Every entry in `CAREER_ROUTE` has a short code in `COMPANY_SHORT_CODES`.
- Short codes match the spec: MAV, 8FG, RVS, STE, TGS.
- The lookup is total — given any `CompanyId` from the route, the lookup returns a `ShortCode`. (Type system enforces this.)

### `ProgressCard.test.tsx` — pure UI (props in / events out)

Component port: props are the parsed projection + the latest visit event (or `null`) + motion preference. The test never reaches into hooks or animation timing.

**Rendering:**
- Renders the headline planet for each `Headline.kind` (empty, anchor, active, complete).
- Renders the headline short code text matching `Headline.company.shortCode` when not empty; renders `—` when empty.
- Renders the status label matching `StatusLabel.kind`.
- Renders the counter with the visited / total numbers.
- Renders 5 pip elements in DOM order matching `pips` tuple order.
- Each pip element carries a `data-state` attribute matching its `Pip.kind`.

**Motion preference:**
- With `motion.kind === 'reduced'`, the card element carries `data-motion="reduced"`; no ripple elements are rendered even when a visit event is fresh.
- With `motion.kind === 'normal'`, the card carries `data-motion="normal"`; ripple elements appear during the visit event window.

**Visit event reception:**
- When a `first_visit` event is passed, the pip whose companyId matches receives a `data-burst="active"` attribute for the choreography window; after the window, the attribute is removed.
- When a `revisit` event is passed, no pip gets `data-burst`; only the headline cross-fade triggers.
- When `null` is passed, the card is in steady state.

**Accessibility:**
- The card has `aria-label="Exploration progress"`.
- The counter exposes `role="status"` and `aria-live="polite"`, so screen readers hear "3 of 5 systems explored" or equivalent when the counter ticks.
- Each pip has an accessible name including the company's display name and its state ("Mave, visited"; "Riverside, currently exploring"; "TGS, unexplored").
- The headline short code is decorative (`aria-hidden`); the full company name is exposed via the headline planet's accessible name.

### `useProgress.test.ts` — wiring

Feed a fake `SceneState`, a controllable visited array, the canonical `CAREER_ROUTE`, and a fake motion-preference subscription; assert the `{ projection, visitEvent, motion, visibility }` returned. No JSX inspected.

- Initial mount with `loading` state → visibility `hidden`, projection well-defined.
- State transition `loading → playing` → visibility flips `visible`, projection unchanged.
- State transition `playing → revealing(mave)` with `visited=[]` → projection has `here(mave)`, visit event `first_visit(mave, completesRoute: false)`.
- Same as above with `visited=[mave]` → visit event `revisit(mave)`.
- State transition `revealing(mave) → playing` with `visited=[mave]` → projection swaps `here` to `visited`, visit event `depart(mave)`.
- 5th visit → visit event carries `completesRoute: true`.
- Subsequent renders with no projection change → visit event is `null`.
- Motion-preference subscription is unsubscribed on unmount.

### `projectVisibility.test.ts`

Same shape as `projectDockVisibility.test.ts` — outline for each `SceneState.kind`.

---

## Coverage checklist

- [x] Acceptance — card visible during `playing | revealing | paused`, hidden during `loading`
- [x] Acceptance — headline shows the active planet during `revealing`
- [x] Acceptance — headline shows the anchor (last-visited) when free-roaming
- [x] Acceptance — headline is empty / standby pre-route
- [x] Acceptance — headline marks route_complete after the 5th visit
- [x] Acceptance — counter reflects visited.length, no off-by-one
- [x] Acceptance — pip column always rendered in canonical career order (out-of-order visits do not reorder)
- [x] Acceptance — visit event detected on transitions; counter & pip update together
- [x] Acceptance — revisits do not tick the counter, do not emit ripples
- [x] Acceptance — route-complete plays the green takeover + persistent breathing border
- [x] Acceptance — short codes MAV / 8FG / RVS / STE / TGS
- [x] Motion — reduced-motion strips ripples, scale pump, border swell, type-in, breathing border
- [x] Motion — reduced-motion still surfaces state changes (counter still ticks, pip still changes color, instantly)
- [x] A11y — counter announces via aria-live polite
- [x] A11y — each pip exposes an accessible name with state
- [x] A11y — headline planet exposes the company's full name
- [x] Layer rule — card never imports from comms/audio/ships features; never imports from `core/`
- [x] Layer rule — components never see `SceneState`; receive parsed projection only
- [x] Layer rule — `projectProgress` is pure; no React import; no DOM access

---

## Self-check

1. **Could the implementation be rewritten in Solid + a different 3D library + a different motion library and every test still make sense?**
   - `projectProgress.test.ts` — pure function on plain types; framework-free. Pass.
   - `detectVisitEvents.test.ts` — pure diff; framework-free. Pass.
   - `shortCodes.test.ts` — pure lookup; framework-free. Pass.
   - `projectVisibility.test.ts` — pure function; framework-free. Pass.
   - `ProgressCard.test.tsx` — props in / events out / data attributes / accessible names. No hooks, no DOM internals beyond the port surface. Pass.
   - `useProgress.test.ts` — feeds fake state, controllable subscription; asserts return-shape only. No JSX. Pass.

2. **Does any scenario name an internal function, hook, store, or framework primitive?** No. References are to ports: `projection`, `visitEvent`, `headline.kind`, `pips[i].kind`, `counter.kind`, `status.kind`, `data-motion`, `data-state`, `data-burst`, `aria-live polite`.

3. **Are illegal states unrepresentable?**
   - `Headline` is a 4-variant union with no shared optionals.
   - `Pip` is a 3-variant union; can never be both visited and unvisited.
   - `Counter` is a 2-variant union; `complete` does not carry a visited count (it's implied 5).
   - `pips` is a 5-tuple, not an array; the type itself proves "exactly 5 in canonical order."
   - `VisitEvent` is a 3-variant union; first-visit vs revisit vs depart cannot be conflated.
   - `StatusLabel` is a 4-variant union; the display string is derived in one place (`StatusLabel.tsx`), not duplicated.

4. **Are symptoms checked?**
   - **Optional-flag explosion?** No — `Counter` is `idle | complete`, `Headline` is `empty | anchor | active | complete`, etc. No boolean toggles.
   - **Sibling-adapter leakage?** No — components never see `SceneState` or the visited array; the widget never sees JSX; the projection function never sees React.
   - **Legacy-pending behavior?** None — this is a new feature.
   - **Long parameter lists?** `projectProgress(state, visited, route)` is 3 params; `detectVisitEvents(prev, next)` is 2 params. Card component receives one projection prop, one visit-event prop, one motion prop, no onActivate (this is read-only UI — no events emit). Within the soft-target.

5. **Does any forbidden phrase appear?** No "quick fix", "for now", "good enough", "temporary", "TODO", "HACK", "FIXME". The persistent breathing border is the design, not a stub.

The spec stands.

---

## Open questions deferred to implementation plan

1. **Pip thumbnail strategy** — Strategy A (shared Canvas) vs Strategy B (baked thumbnails). Recommendation: B. Decision finalized in the plan.
2. **Counter "SYSTEMS" suffix** — show `02 / 05` only, or `02 / 05 SYSTEMS`? The card is narrow; "SYSTEMS" may force a wrap. Decision deferred; spec allows either.
3. **Audio tick on visit** — flagged. The existing `SpaceshipAudio` port supports `setVolume(channel, value)`. Adding a fifth channel (`tick`) with a sample fired on `first_visit` is plausible. Not in scope for this spec; if desired, a separate spec for "visit audio cue."
4. **Sub-component file structure** — whether `HeadlinePlanet`, `ProgressPip`, `ProgressCounter`, `StatusLabel` are independent files or co-located in `ProgressCard.tsx`. The above layout has them split, matching the comms feature's `ChannelButton` + `VelocityReadout` split. The implementation plan may choose to inline if any sub-component proves trivially small.
