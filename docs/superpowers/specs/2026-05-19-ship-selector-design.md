# Ship Selector — Design Spec

**Date:** 2026-05-19
**Status:** Approved, ready for implementation plan
**Authoring agent:** brainstorming (superpowers)

---

## 1. Problem & intent

The user wants to pick one of 8 spaceship models before the 3D scene runs. The player's current Player component (`features/scene/components/Scene/Player.tsx`) hardcodes `craft_speederA.glb`. We replace that constant with a URL-driven choice, present a menu when no choice is in the URL, and render the scene with the chosen ship once a choice exists.

**Ship roster (8 craft models)**

| ShipId | File | Notes |
|---|---|---|
| `speederA` | `craft_speederA.glb` | currently hardcoded |
| `speederB` | `craft_speederB.glb` | |
| `speederC` | `craft_speederC.glb` | |
| `speederD` | `craft_speederD.glb` | |
| `cargoA` | `craft_cargoA.glb` | |
| `cargoB` | `craft_cargoB.glb` | |
| `racer` | `craft_racer.glb` | |
| `miner` | `craft_miner.glb` | |

**UX scope**

- Menu = DOM grid of 8 cards, each card is a live 3D thumbnail.
- Idle: static 3/4 view (Y rotation = π/4).
- Hover: card spins continuously around Y to show all angles.
- Mouse leave: ease back to static angle.
- Click: commits the choice via URL navigation; scene mounts; no re-pick mid-game.

**State ownership**

- URL is the source of truth (`/` vs `/?ship=<id>`).
- Shareable, bookmarkable, refresh-safe.
- `sceneMachine` is untouched — selection is a separate concern.

---

## 2. Approach (chosen: A)

| Approach | Verdict |
|---|---|
| **A. URL-gated selector feature** | **Chosen.** New feature `features/ships/`. Route reads `?ship=`. No ship → selector widget. Ship set → scene widget with prop. `sceneMachine` unchanged. |
| B. Bake selection into `sceneMachine` | Rejected. Couples the scene reducer to an unrelated concern (Iron Law 1 & 4). |
| C. Pre-game overlay on top of paused scene | Rejected. Couples menu lifetime to scene lifetime; adds variants to `sceneMachine`; fights the no-`useEffect`-outside-wiring rule. |

---

## 3. Types & state ownership

**No state-machine changes.** `sceneMachine.ts` and `SceneState` remain byte-for-byte the same. Selection is URL-owned.

### `features/ships/types/ship.ts`

```ts
export const SHIP_IDS = [
  'speederA', 'speederB', 'speederC', 'speederD',
  'cargoA', 'cargoB',
  'racer', 'miner',
] as const;

export type ShipId = (typeof SHIP_IDS)[number];

export type ShipEntry = {
  readonly id: ShipId;
  readonly displayName: string;
  readonly glbPath: string;
  readonly scale: number;
};

export type ShipSelection =
  | { readonly kind: 'unselected' }
  | { readonly kind: 'selected'; readonly ship: ShipEntry };

export type ShipHover =
  | { readonly kind: 'none' }
  | { readonly kind: 'hovering'; readonly id: ShipId };
```

### `features/ships/types/shipRegistry.ts`

```ts
import type { ShipId, ShipEntry } from './ship';

export const SHIP_REGISTRY: Readonly<Record<ShipId, ShipEntry>> = {
  speederA: { id: 'speederA', displayName: 'Speeder A', glbPath: '/models/kenney-space-kit/craft_speederA.glb', scale: 0.6 },
  speederB: { id: 'speederB', displayName: 'Speeder B', glbPath: '/models/kenney-space-kit/craft_speederB.glb', scale: 0.6 },
  speederC: { id: 'speederC', displayName: 'Speeder C', glbPath: '/models/kenney-space-kit/craft_speederC.glb', scale: 0.6 },
  speederD: { id: 'speederD', displayName: 'Speeder D', glbPath: '/models/kenney-space-kit/craft_speederD.glb', scale: 0.6 },
  cargoA:   { id: 'cargoA',   displayName: 'Cargo A',   glbPath: '/models/kenney-space-kit/craft_cargoA.glb',   scale: 0.5 },
  cargoB:   { id: 'cargoB',   displayName: 'Cargo B',   glbPath: '/models/kenney-space-kit/craft_cargoB.glb',   scale: 0.5 },
  racer:    { id: 'racer',    displayName: 'Racer',     glbPath: '/models/kenney-space-kit/craft_racer.glb',    scale: 0.6 },
  miner:    { id: 'miner',    displayName: 'Miner',     glbPath: '/models/kenney-space-kit/craft_miner.glb',    scale: 0.55 },
};

export const lookupShip = (id: ShipId): ShipEntry => SHIP_REGISTRY[id];
```

The registry is a **TotalMap** — `lookupShip(id)` returns `ShipEntry`, not `ShipEntry | undefined`. No `??`, no `as`, no `!`. Scale values are starting estimates; tune during implementation if any ship looks too big/small relative to the world.

**Iron Law alignment**
- `ShipId` is a literal union — same precedent as `PlanetAssetId`.
- `ShipSelection`, `ShipHover` are discriminated unions tagged by `kind`.
- TotalMap pattern keeps lookup return type concrete (Iron Law 3).
- No suppressors.

---

## 4. Folder shape & ports

### New feature

```
features/ships/
├── types/
│   ├── ship.ts                  — SHIP_IDS, ShipId, ShipEntry, ShipSelection, ShipHover
│   └── shipRegistry.ts          — SHIP_REGISTRY, lookupShip
├── schema/
│   └── shipSearch.ts            — zod parser for ?ship=…
├── components/
│   └── ShipSelector/
│       ├── ShipSelector.tsx     — grid layout; maps ships → ShipCard
│       ├── ShipCard.tsx         — one DOM tile; emits hover/pick; mounts a <View>
│       └── ShipViewport.tsx     — drei <View> contents: camera, lights, GLB, rotation
└── widget/
    └── selector/
        ├── useShipSelector.ts   — owns ShipHover state; forwards onPick from props
        └── ShipSelectorWidget.tsx — mounts <Canvas> overlay + DOM grid; preloads GLBs
```

### Modified — scene feature

- `Player.tsx` — accepts `ship: ShipEntry`; drops `SHIP_PATH`/`SHIP_SCALE` constants and module-level preload (the selector handles preload for all 8).
- `Scene.tsx` — gains `ship: ShipEntry` prop; threads to `Player`.
- `SceneWidget.tsx` — gains `ship: ShipEntry` prop; threads to `Scene`.
- `useScene.ts` — unchanged. Knows nothing about ships.
- `sceneMachine.ts` — unchanged.

### Modified — route

- `routes/index.tsx` — adds `validateSearch`; branches between `ShipSelectorWidget` and `SceneWidget(ship)`.

### Ports (every cross-layer signature)

| Direction | Shape |
|---|---|
| URL → Route | `validateSearch(raw): { ship?: ShipId }` |
| Route → `SceneWidget` | `ship: ShipEntry` |
| Route → `ShipSelectorWidget` | `onPick: (id: ShipId) => void` |
| `SceneWidget` → `Scene` | existing props + `ship: ShipEntry` |
| `Scene` → `Player` | existing props + `ship: ShipEntry` |
| `ShipSelectorWidget` → `ShipSelector` | `{ ships, hover: ShipHover, onHoverEnter, onHoverLeave, onPick }` |
| `ShipSelector` → `ShipCard` | `{ ship, isHovered, onHoverEnter, onHoverLeave, onPick }` |
| `ShipCard` → `ShipViewport` | `{ ship: ShipEntry, isHovered: boolean }` |

**Rule alignment**

- Hover crosses ports as a DU + two events (`onHoverEnter` / `onHoverLeave`) — no nullable parameter.
- Selector widget never imports the router; route never imports `components/`.
- Scene feature imports `ShipEntry` (pure type) from `features/ships/types/ship` — cross-feature import of data only; no React/DOM leak.
- `useGLTF` lives in leaf components (`Player`, `ShipViewport`) — matches `Planet.tsx` precedent.

---

## 5. URL schema & route gate

### `features/ships/schema/shipSearch.ts`

```ts
import { z } from 'zod';
import { SHIP_IDS } from '../types/ship';

const shipIdSchema = z.enum(SHIP_IDS);
const searchSchema = z.object({ ship: shipIdSchema.optional() });

export type ShipSearch = z.infer<typeof searchSchema>; // { ship?: ShipId }

export const parseShipSearch = (raw: Record<string, unknown>): ShipSearch => {
  const result = searchSchema.safeParse(raw);
  return result.success ? result.data : {};
};
```

`SHIP_IDS` is the single source of truth — adding a ship adds one literal; the zod enum and `ShipId` track automatically. Garbage `?ship=foo` falls through to "unselected" — the parse failure is folded at the boundary, never asserted downstream.

### `src/routes/index.tsx`

```tsx
import type { JSX } from 'react';
import { useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SceneWidget } from '../features/scene/widget/scene/SceneWidget';
import { ShipSelectorWidget } from '../features/ships/widget/selector/ShipSelectorWidget';
import { parseShipSearch } from '../features/ships/schema/shipSearch';
import { lookupShip } from '../features/ships/types/shipRegistry';
import type { ShipId, ShipSelection } from '../features/ships/types/ship';

export const Route = createFileRoute('/')({
  validateSearch: parseShipSearch,
  component: IndexPage,
});

export const toSelection = (shipId: ShipId | undefined): ShipSelection =>
  shipId === undefined
    ? { kind: 'unselected' }
    : { kind: 'selected', ship: lookupShip(shipId) };

function IndexPage(): JSX.Element {
  const { ship } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selection = toSelection(ship);

  const onPick = useCallback(
    (id: ShipId) => { void navigate({ search: { ship: id } }); },
    [navigate],
  );

  switch (selection.kind) {
    case 'unselected': return <ShipSelectorWidget onPick={onPick} />;
    case 'selected':   return <SceneWidget ship={selection.ship} />;
  }
}
```

The single `=== undefined` check sits in `toSelection` — the parse-boundary convert from URL shape (zod's natural `{ ship?: ShipId }`) to domain DU. Downstream switches on `kind`, exhaustive.

**Lib best-practice notes**

- `validateSearch: parseShipSearch` is the canonical TanStack Router pattern.
- `Route.useSearch()` / `Route.useNavigate()` are the route-scoped typed hooks.
- zod 4's `z.enum(SHIP_IDS)` accepts `as const` readonly tuples — no spread, no cast.
- Unknown URL keys are dropped by the schema (default; we do not call `.strict()`).

---

## 6. Render plan (drei `<View>`, hover rotation, preloading)

### Topology

```
ShipSelectorWidget (route-mounted)
└── full-screen container
    ├── DOM grid (foreground, receives all input)
    │   └── ShipCard ×8
    │        ├── thumbnail box (transparent)
    │        │   └── <View>           ← portaled into Canvas
    │        │        └── ShipViewport (camera, lights, GLB, rotation)
    │        └── ShipName label
    └── <Canvas style="fixed inset-0; pointer-events:none">  ← background layer
         └── <View.Port />            ← drei stitches all <View>s here
```

The Canvas sits behind the DOM with `pointer-events: none`; each `<View>` is rendered inside its card's transparent thumbnail box. drei matches the rendered region to the card's DOM rect (auto-tracked on scroll/resize). The card receives hover/click; the 3D shines through the transparent thumbnail.

**`<View>` mode — portal (`View.Port`)** — chosen over `<View track={ref}>` because it colocates the 3D content with the card component (hover state stays card-local, no lifting). Canonical drei pattern for "many small viewports in a DOM grid".

### `ShipViewport.tsx` (pure component, controlled by `isHovered`)

```tsx
const STATIC_ANGLE_Y = Math.PI * 0.25;  // 3/4 view (45°)
const HOVER_SPEED = 1.5;                 // rad/s; ~4.2s per revolution
const REST_LERP = 0.1;                   // ~300ms ease back
const TWO_PI = Math.PI * 2;

// Pure helper — unit-testable.
export const tickRotation = (
  currentY: number,
  isHovered: boolean,
  delta: number,
): number => {
  if (isHovered) return currentY + HOVER_SPEED * delta;
  let d = STATIC_ANGLE_Y - currentY;
  while (d > Math.PI)  d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return currentY + d * REST_LERP;
};

export const ShipViewport = (props: { ship: ShipEntry; isHovered: boolean }): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF(props.ship.glbPath);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y = tickRotation(g.rotation.y, props.isHovered, delta);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.2, 4]} fov={35} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 6, 5]} intensity={1.4} />
      <Center>
        <group ref={groupRef} scale={props.ship.scale}>
          <primitive object={scene} />
        </group>
      </Center>
    </>
  );
};
```

Mirrors `Player.tsx` precedent: `useGLTF` + `Center` + per-component camera & lights. Each View gets its own camera via `makeDefault` inside its subtree.

### `ShipCard.tsx`

```tsx
export const ShipCard = (props: ShipCardProps): JSX.Element => (
  <button
    type="button"
    data-hovered={props.isHovered ? 'true' : 'false'}
    onMouseEnter={() => props.onHoverEnter(props.ship.id)}
    onMouseLeave={props.onHoverLeave}
    onClick={() => props.onPick(props.ship.id)}
    className={cardClassName}
  >
    <div className={thumbnailClassName}>
      <View>
        <ShipViewport ship={props.ship} isHovered={props.isHovered} />
      </View>
    </div>
    <span className={labelClassName}>{props.ship.displayName}</span>
  </button>
);
```

`<button type="button">` — keyboard-accessible by default (Space/Enter trigger `onClick`), browser-native focus ring.

### `ShipSelectorWidget.tsx`

```tsx
const CANVAS_STYLE = { position: 'fixed', inset: 0, pointerEvents: 'none' } as const;

export const ShipSelectorWidget = (props: { onPick: (id: ShipId) => void }): JSX.Element => {
  const { ships, hover, onHoverEnter, onHoverLeave } = useShipSelector();
  return (
    <div className={containerClassName}>
      <h1 className={titleClassName}>Choose your ship</h1>
      <ShipSelector
        ships={ships}
        hover={hover}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        onPick={props.onPick}
      />
      <Canvas style={CANVAS_STYLE} dpr={[1, 2]}>
        <View.Port />
      </Canvas>
    </div>
  );
};

// Side-effect preload: when this module loads, all 8 GLBs start fetching.
for (const ship of Object.values(SHIP_REGISTRY)) useGLTF.preload(ship.glbPath);
```

By the time the user picks, the chosen GLB is already cached — `Player` mounts and `useGLTF(ship.glbPath)` hits the cache instantly.

### `useShipSelector.ts`

```tsx
const NO_HOVER: ShipHover = { kind: 'none' };

export const useShipSelector = (): UseShipSelectorResult => {
  const [hover, setHover] = useState<ShipHover>(NO_HOVER);
  const onHoverEnter = useCallback((id: ShipId) => setHover({ kind: 'hovering', id }), []);
  const onHoverLeave = useCallback(() => setHover(NO_HOVER), []);
  return {
    ships: Object.values(SHIP_REGISTRY),
    hover,
    onHoverEnter,
    onHoverLeave,
  };
};
```

No `useEffect`. No URL knowledge (route owns that). Pure event-out widget hook.

### `isHovered` derivation — in the pure component

```tsx
const isHovered = (hover: ShipHover, id: ShipId): boolean =>
  hover.kind === 'hovering' && hover.id === id;
```

### `Player.tsx` changes

The `SHIP_PATH` constant disappears; `ship` arrives as a prop:

```tsx
type PlayerProps = {
  readonly ship: ShipEntry;
  // …existing props
};
// …
const { scene } = useGLTF(props.ship.glbPath);
const shipScale: readonly [number, number, number] = [
  props.ship.scale, props.ship.scale, props.ship.scale,
];
// …
// remove the module-level `useGLTF.preload(SHIP_PATH);` line.
```

**Lib best-practice notes**

- drei `<View>` + `<View.Port />` — single WebGL context, scissor-rendered tiles, auto-tracked rect.
- One `<PerspectiveCamera makeDefault>` per View.
- `useGLTF.preload(path)` at module scope — drei's recommended cache-warm pattern.
- `Center` (drei) normalizes model pivot — matches existing `Player`/`Planet`.
- `<Canvas dpr={[1, 2]}>` matches scene Canvas.
- `pointer-events: none` on Canvas + DOM cards on top — standard "DOM-driving + 3D-decorating" pattern.

---

## 7. Install plan — Tailwind v4 + shadcn (base-ui style)

**Empty slots in repo:** `src/components/` and `src/lib/` exist but are empty. No CSS yet — only inline `<style>` in `index.html` for the root reset. Vite alias `@` → `src/` is already wired.

### Steps

1. **Tailwind v4 (CSS-first config, Vite plugin):**
   ```
   pnpm add -D tailwindcss @tailwindcss/vite
   ```

2. **Vite plugin** — add to `vite.config.ts`:
   ```ts
   import tailwindcss from '@tailwindcss/vite';
   // …
   plugins: [
     TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
     react(),
     tailwindcss(),
   ],
   ```

3. **Global stylesheet** — `src/styles/globals.css`:
   ```css
   @import "tailwindcss";

   @theme {
     --color-bg: #04050a;          /* matches Scene background */
     --color-fg: #e6eaf2;
     --color-accent: #5fd6ff;       /* matches engine-trail cyan */
     --color-card: #0a0d18;
     --color-card-hover: #11162a;
     --color-card-ring: #5fd6ff44;
   }

   html, body, #root {
     margin: 0;
     width: 100vw;
     height: 100vh;
     overflow: hidden;
   }
   ```

4. **`main.tsx`** — add `import './styles/globals.css';` at the top.

5. **`index.html`** — remove the inline `<style>` block (migrated to `globals.css`); one source of CSS truth.

6. **shadcn init (base-ui style):**
   ```
   pnpm dlx shadcn@latest init
   ```
   Prompts:
   - Style: **Base UI**
   - CSS file: `src/styles/globals.css`
   - cn helper: `src/lib/utils.ts`
   - Components alias: `@/components/ui`

   This creates `components.json`, `src/lib/utils.ts` (the `cn` helper), and appends shadcn's design tokens to `globals.css`.

   **Hiccup-to-verify-at-install-time:** the "Base UI" style option label and its registry path drift occasionally between shadcn releases. If `init` doesn't surface the option, fall back to the registry URL flag at the time of install. Document the actual command used in the implementation plan.

7. **Components to add: none.** The menu only needs styled `<button>` tiles and a heading. Tailwind utilities + `cn` cover it. Iron Law 4 — no abstraction earns its place until it removes more than it adds. If a future modal/dialog lands, install just that one via `pnpm dlx shadcn@latest add dialog`.

### Where pixels live

- Tailwind classes appear ONLY inside `features/<feature>/components/`. Project rule: pixels live with components only; never in routes, widgets, api, or services.
- `cn()` from `@/lib/utils` is imported by components only.
- Tokens (`--color-card`, etc.) live in `globals.css`; components reference them via Tailwind v4's CSS-var bracket syntax: `bg-[--color-card]`, `text-[--color-fg]`.

---

## 8. Test plan (BDD + TDD)

Follows existing project pattern: extract pure logic, test it directly; smoke-test hooks via `renderHook`; **do not mount R3F components** in jsdom.

### BDD scenarios

```gherkin
Feature: Ship selection
  Visitor picks a spaceship before the scene loads.

  Scenario: First visit shows the selector
    Given the URL is "/"
    When the page mounts
    Then the ship selector is rendered
    And the scene widget is not rendered

  Scenario: Valid pre-selected ship URL skips the selector
    Given the URL is "/?ship=speederA"
    When the page mounts
    Then the scene widget is rendered with ship "speederA"
    And the ship selector is not rendered

  Scenario: Unknown ship value falls through to the selector
    Given the URL is "/?ship=foo"
    When the page mounts
    Then the ship selector is rendered

  Scenario: Picking a ship updates the URL and switches to the scene
    Given the ship selector is rendered
    When the user clicks the "Speeder A" card
    Then the URL search becomes "?ship=speederA"
    And the scene widget is rendered with ship "speederA"

  Scenario: Hovering a card marks only that card hovered
    Given the ship selector is rendered with hover.kind === 'none'
    When the user hovers the "Speeder B" card
    Then the "Speeder B" card receives isHovered=true
    And every other card receives isHovered=false

  Scenario: Mouse-leave clears the hover state
    Given the user is hovering the "Speeder B" card
    When the user leaves the card
    Then no card has isHovered=true
```

### TDD bullets per port

**`features/ships/schema/shipSearch.test.ts`** — pure parser:
- accepts each of the 8 SHIP_IDS as `ship`
- `{ ship: 'foo' }` → returns `{}`
- `{ ship: 123 }` → returns `{}`
- `{}` → returns `{}`
- `{ ship: 'speederA', other: 'x' }` → returns `{ ship: 'speederA' }` (unknown keys stripped)

**`features/ships/types/shipRegistry.test.ts`** — invariant checks:
- `SHIP_REGISTRY[id].id === id` for every id
- `SHIP_REGISTRY` has exactly 8 keys, matching `SHIP_IDS`
- every `displayName` is unique
- every `glbPath` starts with `/models/kenney-space-kit/craft_`
- every `scale` is finite and positive

**`src/routes/index.test.tsx`** — pure selection helper:
- `toSelection(undefined)` → `{ kind: 'unselected' }`
- `toSelection('speederA')` → `{ kind: 'selected', ship: <SHIP_REGISTRY.speederA> }`
- 8 fixtures, one per ShipId

**`features/ships/widget/selector/useShipSelector.test.ts`** — `renderHook`:
- initial `hover.kind === 'none'`, `ships.length === 8`, ships keep `SHIP_IDS` order
- `act(() => onHoverEnter('speederA'))` → `hover === { kind: 'hovering', id: 'speederA' }`
- `act(() => onHoverEnter('speederB'))` after the above → `hover.id === 'speederB'`
- `act(() => onHoverLeave())` → `hover.kind === 'none'`
- `ships`, `onHoverEnter`, `onHoverLeave` identities stable across re-renders

**`features/ships/components/ShipSelector/ShipCard.test.tsx`** — pure DOM (no R3F mount; thin mock of drei `View`):
- renders `ship.displayName`
- element is `<button type="button">`
- `mouseEnter` → calls `onHoverEnter(ship.id)`
- `mouseLeave` → calls `onHoverLeave()`
- `click` → calls `onPick(ship.id)`
- with `isHovered=true`, the rendered button carries `data-hovered="true"` (used for both test assertions and Tailwind v4 `data-[hovered=true]:` variant styling)

**`features/ships/components/ShipSelector/ShipSelector.test.tsx`:**
- renders 8 cards (queried by `role="button"`)
- when `hover === { kind: 'hovering', id: 'cargoA' }`, only the cargoA card has `data-hovered="true"`
- when `hover.kind === 'none'`, no card has `data-hovered="true"`

**`features/ships/components/ShipSelector/ShipViewport.test.ts`** — pure rotation helper + R3F-mocked smoke:
- `tickRotation(0, true, 1)` === `HOVER_SPEED`
- `tickRotation(0, false, 1)` lerps toward `STATIC_ANGLE_Y`
- shortest-path through ±π seam handled (no 2π detours)
- mocked drei: `useGLTF` is called with `props.ship.glbPath`
- the rendered `<group>` has `scale === ship.scale` (in all three axes)

**`features/scene/components/Scene/Player.test.tsx`** — extend existing:
- `Player` accepts `ship: ShipEntry`; the GLB path passed to the `useGLTF` mock equals `ship.glbPath`

**`src/__tests__/route-gate.smoke.test.tsx`** — router-level smoke (`createMemoryHistory`):
- mount router at `/` → `<ShipSelectorWidget>` is in the tree; `<SceneWidget>` is not
- mount router at `/?ship=speederA` → `<SceneWidget>` is in the tree with `ship.id === 'speederA'`; `<ShipSelectorWidget>` is not
- mount router at `/?ship=foo` → falls to selector
- mount at `/`, simulate click on the Speeder A card → `router.state.location.search` becomes `{ ship: 'speederA' }`

`useScene.smoke.test.ts` — unchanged. `sceneMachine.test.ts` — unchanged.

### Test infra notes

- `vi.mock('@react-three/drei', ...)` and `vi.mock('@react-three/fiber', ...)` get reused for the new component tests; existing tests already set these up.
- Router smoke test uses `createMemoryHistory({ initialEntries: ['/?ship=...'] })` — no jsdom URL manipulation.
- All tests are pure DOM (jsdom). No WebGL context is created in tests — the `tickRotation` unit tests cover the only "frame logic" worth verifying.

---

## 9. Rule alignment summary

**Iron Law 1 (Hexagonal):**
- New `features/ships/` is a vertical slice with its own types, schema, components, widget — same shape as `features/scene/`.
- Route is the URL adapter; widget is the wiring adapter; components are the pixel adapter. No leakage.
- Selector widget never imports the router; the route never imports `components/`.

**Iron Law 2 (Discriminated unions):**
- `ShipSelection`, `ShipHover` are `kind`-tagged DUs.
- `ShipId` is a literal union (precedent: `PlanetAssetId`).

**Iron Law 3 (Illegal states unrepresentable):**
- `lookupShip` is a TotalMap — returns `ShipEntry`, never `undefined`.
- `parseShipSearch` is the single parse boundary; downstream never re-checks.
- The lone `=== undefined` check sits in `toSelection`, the parse-boundary convert from URL shape to domain DU. Downstream switches on `kind`, exhaustive.
- No `!`, no `as T`, no `??`, no `||`, no `@ts-ignore`, no eslint-disable.

**Iron Law 4 (Design discipline):**
- `sceneMachine` is untouched — selection is a different concern.
- No abstraction added until it earns its place: no shadcn components installed, no helper utilities, no "future-proofing" hooks.
- Hover modeled as DU + two events (not as `ShipId | null` param).

**Supporting rules:**
- Parse, don't validate.
- No `useEffect` outside the widget composition root (and we don't use any in the selector widget at all — it's pure `useState` + `useCallback`).
- Pixels (Tailwind classes) live in components only.

---

## 10. Out of scope (deliberately, per YAGNI)

- Re-pick mid-game / pause-menu ship change.
- Persisting choice in localStorage (URL already covers refresh).
- Animations for menu enter/exit transition.
- Per-ship physics tuning (speed, mass, agility).
- Sound on hover/pick.
- Touch/mobile gesture handling (mouseEnter/mouseLeave imply pointer device; revisit if mobile matters).

---

## 11. Pipeline

Per project rules, **Full UI Feature** pipeline with the following adjustments:

- `state-machine-agent` — **skip.** No state machine changes (decided in Section 3).
- `data-adapter-builder` — **needed only for schema/.** Light touch: `features/ships/schema/shipSearch.ts` is the only adapter file.

Ordering:

1. `bdd-tdd-spec-writer` — finalize BDD/TDD test files from Section 8.
2. `core-architecture-guardian` (plan mode) — sanity-check the layer boundaries before coding.
3. `data-adapter-builder` — `features/ships/schema/shipSearch.ts` only.
4. `ui-component-builder` — `ShipSelector.tsx`, `ShipCard.tsx`, `ShipViewport.tsx`, also extend `Player.tsx` for the new prop.
5. `styles-motion` — Tailwind v4 install, `globals.css`, shadcn init, component classNames.
6. `feature-wiring` — `useShipSelector.ts`, `ShipSelectorWidget.tsx`, `SceneWidget.tsx` prop plumbing.
7. `route-url-adapter` — `routes/index.tsx` with `validateSearch` and the route gate.
8. `core-architecture-guardian` (code mode) — audit.
9. `rules-guardian` — final compliance audit.
