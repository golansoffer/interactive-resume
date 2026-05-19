# Planet & Company Configuration — Design Spec

**Date:** 2026-05-19
**Status:** Design locked. Implementation deferred to a follow-up session via writing-plans.
**Predecessor:** [2026-05-19-3d-renderer-design.md](./2026-05-19-3d-renderer-design.md) — defines the existing `CompanyId`, `Company`, and scene FSM that this design extends.

---

## Scope

Define the data model behind planet-rendered companies. Each planet on the scene corresponds to one company from the resume. The model separates two concerns:

1. **Planet visual configuration** — what the planet looks like and where it sits in the scene.
2. **Company info content** — name, logo, role, period, description.

The two concerns share a single composite root (`CompanyEntry`) but cross consumer ports as narrow projections — information leaks between concerns are unrepresentable at the prop-type level.

**This spec defines the types and the consumer port projections.** It does NOT define rendering behavior, animation, label/reveal UI, or asset loading — those are downstream of this foundation. The follow-up implementation wave creates the new type files **and** migrates every existing consumer in the same commit (no coexistence with the old `Company` type — Iron Law 4: zero accumulation).

---

## Domain flow (what the data has to support)

The end-goal player flow, used to validate the model:

1. The player navigates the scene and sees planets at a distance.
2. Each planet shows a label (company name + logo) at all times.
3. When the player enters a planet's proximity radius, the reveal expands to show: role, period, description.
4. When the player leaves the radius, the reveal collapses back to the label.

The scene FSM (`src/core/scene/sceneMachine.ts`) already supports the proximity-triggered reveal via `SceneState.revealing { objectId }`. **No FSM changes are required by this design.** Labels are structural: every planet renders one regardless of FSM state.

---

## Architecture decision

**Chosen:** bundled composite root (`CompanyEntry`) with narrow consumer ports.

### Three alternatives considered

- **(A) Bundled root with narrow ports.** `CompanyEntry = { id, planet, info }`. Each component receives only its slice via prop type. **Chosen.**
- **(B) Parallel datasets joined by `CompanyId`.** Separate `PlanetConfig[]` and `CompanyInfo[]` lists, joined at runtime. **Rejected:** introduces orphan-id risk (a planet without info, or info without a planet), and forces two-source edits per company.
- **(C) Decoupled planet pool with slot references.** `PlanetConfig` has its own `PlanetSlotId`; companies reference which slot they sit on. **Rejected:** the relationship is 1:1, no empty planets, no floating companies. The abstraction hasn't earned its place (Iron Law 4).

### Why (A)

The "no information leaks" guarantee comes from the **prop-type narrowness of each consumer**, not from physical data separation. A `PlanetRenderer` whose props type is `PlanetConfig` cannot see company info regardless of whether `PlanetConfig` came from a parallel array or a sub-field of `CompanyEntry`. The port shape is what matters.

(A) wins on Iron Law 3: orphan ids are unrepresentable by construction. One source of truth, narrow projections at every consumer, one-place edit per company.

---

## Type definitions

### `PlanetConfig` — `src/features/scene/types/planet.ts`

```typescript
export type PlanetConfig = {
  readonly color: string;
  readonly placement: readonly [number, number, number];
};
```

Decisions:

- **Interim: `color` over a sprite asset id.** Originally `assetId: PlanetAssetId` (closed literal union of 10 Kenney sprites). The 2D sprite rendering proved too flat for the spaceflight feel; the wave that lands real 3D planet assets will replace `color` with an asset reference. Until then, each company carries a hex color and renders as a 3D sphere with that color — `meshStandardMaterial`, slow Y-axis spin.
- **Placement on `PlanetConfig`.** Where a planet renders is intrinsic to its visual identity in the scene. Splitting placement into a separate `Placement` type would create a one-field record and add a layer for nothing (Iron Law 4).
- **No `scale`, `rotation`, `tint`, `glow`, `ring` fields.** Iron Law 4 (design discipline): no flexibility knobs until they earn their place. Add when a renderer actually needs them.
- **Tuple shape for `placement`.** Matches the existing `Company.position` tuple form. R3F components consume tuples directly via `<mesh position={...} />`. Math services convert to plain records `{ x, y, z }` at their own boundary (see `services/renderer/vec3.ts`).

### `YearMonth` + `Period` — `src/features/scene/types/period.ts`

```typescript
// Closed literal union: month 13 is unrepresentable.
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type YearMonth = {
  readonly year: number;
  readonly month: Month;
};

// 'Present' is a variant of Period, not an absent end-date field.
export type Period =
  | { readonly kind: 'closed';  readonly start: YearMonth; readonly end: YearMonth }
  | { readonly kind: 'ongoing'; readonly start: YearMonth };
```

Decisions:

- **`Period` is the discriminator.** `kind: 'closed' | 'ongoing'` lives on Period itself, not on a sub-field. UI rendering branches once at the top level on `period.kind`.
- **No `endDate?: YearMonth`.** Iron Law 3: optional fields acting as implicit state flags are banned. Ongoing roles and past roles have different shapes — discriminated, not optional.
- **`Month` is a literal union, not `number`.** Iron Law 3: invalid months unrepresentable structurally, not via comment. Lets consumer code use an exhaustive switch over months without a "default" / unreachable branch — necessary because `noUncheckedIndexedAccess: true` makes `arr[month - 1]` return `T | undefined`, which would force a banned `!` or `??` suppressor.

### `CompanyInfo` — `src/features/scene/types/company-info.ts`

```typescript
import type { Period } from './period';

export type CompanyInfo = {
  readonly companyName: string;
  readonly logoSrc: string;
  readonly role: string;
  readonly period: Period;
  readonly description: string;
};
```

Decisions:

- **One `description` field.** Matches the resume PDF (one paragraph per company). The paragraph already covers both "what the company is" and "what I did there" — no need to split into `companyBlurb` + `experienceBlurb`.
- **`logoSrc: string` (not branded).** Path under `public/logos/<name>.<ext>`. Branding adds machinery without value here — logo loading happens at the asset boundary and load failure is a runtime concern, not a type concern.
- **No `location`, `tagline`, `highlights[]`, `techStack[]`, `link`, `brandColor`.** User-confirmed field set. YAGNI.

### `CompanyEntry` — `src/features/scene/types/company.ts` (extended)

```typescript
import type { PlanetConfig } from './planet';
import type { CompanyInfo } from './company-info';

export type CompanyId = string & { readonly __brand: 'CompanyId' };
export const asCompanyId = (raw: string): CompanyId => raw as CompanyId;

export type CompanyEntry = {
  readonly id: CompanyId;
  readonly planet: PlanetConfig;
  readonly info: CompanyInfo;
};
```

Decisions:

- **`CompanyEntry` replaces the existing `Company` type.** The implementation wave that creates these types ALSO removes `Company` and migrates every consumer in the same commit. No two `Company` shapes coexist (Iron Law 4: zero accumulation; no "for now").
- **`CompanyId` and `asCompanyId` are unchanged.** The existing grep-based invariant tests in `src/features/scene/types/company.test.ts` (single minter, single cast) continue to pass.
- **No top-level `placement` on `CompanyEntry`.** Placement lives on `planet.placement` because it's the planet's intrinsic property; flattening it would obscure the visual/info split.

---

## Consumer ports — narrow projections

No component ever receives the full `CompanyEntry`. The widget extracts each consumer's narrow slice. Every prop type below tells you exactly what that consumer can see.

### Planet renderer — `<Companies />` (existing component, prop type changes)

```typescript
type PlanetProjection = {
  readonly id: CompanyId;
  readonly planet: PlanetConfig;
};

type CompaniesProps = {
  readonly planets: ReadonlyArray<PlanetProjection>;
};
```

Cannot access `companyName`, `logoSrc`, `role`, `period`, or `description`. Renders one 3D sphere per entry using `planet.color` and `planet.placement`, with a slow Y-axis spin.

### Always-visible label — new component (suggested: `<PlanetLabels />`)

```typescript
type LabelProjection = {
  readonly id: CompanyId;
  readonly placement: readonly [number, number, number];
  readonly companyName: string;
  readonly logoSrc: string;
};

type PlanetLabelsProps = {
  readonly labels: ReadonlyArray<LabelProjection>;
};
```

Cannot access `role`, `period`, `description`, or `assetId`. Renders a label (logo + name) anchored above each planet, at all distances, regardless of FSM state.

### Proximity reveal — `<RevealOverlay />` (existing stub, prop type changes)

```typescript
import type { CompanyInfo } from '../../types/company-info';

type RevealOverlayProps = {
  readonly info: CompanyInfo;
  readonly placement: readonly [number, number, number];
};
```

Cannot access `assetId`. Receives the full info content for the currently-revealed company and the placement to anchor the overlay in 3D space. Only rendered when `SceneState.kind === 'revealing'`.

### `proximityCheck` — generic signature

```typescript
import type { Vec3 } from './vec3';

const proximityCheck = <T extends { readonly placement: readonly [number, number, number] }>(
  playerPosition: Vec3,
  targets: ReadonlyArray<T>,
  radius: number,
): ReadonlyArray<T>;
```

Generic over the target shape. Returns the matching targets (full `T`), not just their ids. Replaces the current signature that takes `ReadonlyArray<Company>` and returns `ReadonlySet<CompanyId>`. The math is unchanged; only the I/O shape changes.

This generalization is load-bearing for the lookup elimination below — by returning full entries, the watcher has each match in hand and can attach payload to proximity events without a separate `CompanyId → CompanyInfo` resolution.

### `SceneEvent` — extended payload on entry

```typescript
// src/features/scene/types/scene-event.ts (updated)
import type { CompanyId } from './company';
import type { CompanyInfo } from './company-info';

export type SceneEvent =
  | {
      readonly kind: 'entered_proximity';
      readonly objectId: CompanyId;
      readonly info: CompanyInfo;
      readonly placement: readonly [number, number, number];
    }
  | { readonly kind: 'exited_proximity'; readonly objectId: CompanyId };
```

Decisions:

- **`entered_proximity` carries `info` + `placement`.** `ProximityWatcher` iterates `CompanyEntry`s directly to detect proximity; each entry is in hand at the moment of emission. Attaching the payload to the event eliminates every downstream `CompanyId → CompanyInfo` lookup — the data accompanies the discriminator. (Iron Law 3: no nullable resolution needed; the type itself carries the proof.)
- **`exited_proximity` stays id-only.** On exit, the reveal renderer needs nothing about the entry — the widget just clears its reveal projection. Carrying info on exit would be unused weight.
- **The event `kind` set is unchanged** (still `entered_proximity` | `exited_proximity`), so the existing BDD scenarios in `2026-05-19-3d-foundations-bdd.md` that assert "every `SceneEvent` passed to `onEvent` has `kind` equal to either `entered_proximity` or `exited_proximity`" continue to hold.

### Widget projection — `revealProjection`

The widget consumes `SceneEvent`s and maintains a discriminated `RevealProjection` alongside the FSM:

```typescript
// inside useScene
type RevealProjection =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'visible';
      readonly info: CompanyInfo;
      readonly placement: readonly [number, number, number];
    };
```

State transitions:

- On `entered_proximity { info, placement, objectId }` → `{ kind: 'visible', info, placement }`.
- On `exited_proximity { objectId }` when current projection matches the exiting id → `{ kind: 'hidden' }`.
- On FSM `paused` / resume → projection is preserved (no proximity events fire while paused).

The reveal renderer receives the projection's payload directly when `kind === 'visible'`. No lookup happens anywhere downstream of the proximity event. The FSM stays unchanged (still carries `objectId` only) — the projection is a widget-side data plane parallel to the FSM, fed by the same event stream.

### FSM unchanged

`SceneState.revealing { objectId: CompanyId }` is preserved as-is. The FSM context still carries identity, not info content. The widget's `RevealProjection` is the rendering-input shape; the FSM is the state-transition shape. Both are fed by the same `SceneEvent` stream, so they cannot drift.

### `<ProximityWatcher />` — producer of proximity events

```typescript
type ProximityWatcherProps = {
  readonly sceneState: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly onEvent: (event: SceneEvent) => void;
};
```

`ProximityWatcher` is a **producer**, not a consumer — its responsibility is to detect proximity transitions and emit `SceneEvent`s with the matching entry's payload attached. It receives full `CompanyEntry[]` because it must read both `planet.placement` (for the math) and `info` (for the event payload). This is not an information leak — it's the entry point through which info flows into the event channel; downstream consumers see only narrow projections.

---

## Data source

The widget reads its company list from a single source:

```typescript
// src/features/scene/widget/scene/companies.ts
import { type CompanyEntry, asCompanyId } from '../../types/company';

const COMPANY_ENTRIES: ReadonlyArray<CompanyEntry> = [
  // Mave — Head of Platform — Jan 2025 - Present
  {
    id: asCompanyId('mave'),
    planet: { assetId: 'planet00', placement: [/* tuned during impl */] },
    info: {
      companyName: 'Mave',
      logoSrc: '/logos/mave.svg',
      role: 'Head of Platform',
      period: { kind: 'ongoing', start: { year: 2025, month: 1 } },
      description: 'Employee #1, responsible for building the company\'s end-to-end product execution pipeline from ideation to production. Built the platform from scratch while defining the architecture, standards, and practices behind it. Partnered across product, design, R&D, and QA to drive technical decisions and scalable execution.',
    },
  },
  // ... 4 more entries (see "Resume data — appendix" below)
];

export const getCompanyEntries = (): ReadonlyArray<CompanyEntry> => COMPANY_ENTRIES;
```

Decisions:

- **Hardcoded TS array, not JSON/MDX/API.** Resume data is static, owned by the author, version-controlled with the code. No external boundary, no parser, no `schema/`, no `api/`.
- **Function-wrapped export.** `getCompanyEntries()` matches the existing `getFoundationCompanies()` shape. If a future parser layer is added (e.g., to load from a JSON file the user maintains separately), the export signature doesn't change — only the implementation behind the function does. Consumers are insulated from the source change.
- **Five entries replace the existing eight foundation stubs.** Mave, 8fig, Riverside, StreamElements, TGS.
- **Placements and color assignments are tunable in implementation.** The spec doesn't lock specific coordinates or per-company hex colors — author choice.

---

## Iron Law audit

| Law | How it's met |
|---|---|
| **1 Hexagonal** | Types live in `features/scene/types/`. Each file owns one concern (`planet.ts`, `period.ts`, `company-info.ts`, `company.ts`). Pure-data consumers (planet renderer, label, reveal overlay) receive narrow projections via prop types — they cannot reach across the visual/info split. The proximity-event producer (`ProximityWatcher`) operates on full entries because it is the gateway through which info enters the event channel; downstream still sees only narrow slices. Core (`src/core/scene/sceneMachine.ts`) is untouched; FSM continues to carry `CompanyId` only, never `CompanyInfo`. |
| **2 Discriminated unions** | `Period` is `closed \| ongoing`. `RevealProjection` is `hidden \| visible`. Every variant is a flat object tagged by `kind`. No optional fields acting as state flags. |
| **3 Illegal states unrepresentable** | `CompanyId` is branded with a single minter (existing). `Period.ongoing` has no `end`; `Period.closed` has both — "Present" cannot exist as `endDate: undefined`. One root (`CompanyEntry`) → orphan ids impossible. `SceneEvent.entered_proximity` carries `info` + `placement` directly — the producer attaches the payload at emission, eliminating every downstream `CompanyId → CompanyInfo` lookup and the nullable-suppressor patterns those lookups would require. **Known interim regression:** `PlanetConfig.color: string` is unconstrained — invalid hex like `"#zz0000"` or empty string compiles. The follow-up wave that lands real 3D planet assets replaces `color` with a closed asset reference, restoring full Iron Law 3 coverage. The weakness is bounded, time-limited, and acknowledged here rather than masked. |
| **4 Design discipline** | One root, narrow ports. No `scale`/`rotation`/`tint` until earned. No `schema/`/`api/` until externalized data exists. No fallback `logoSrc?` — every company has one. No two `Company` types coexisting during migration. No TotalMap or lookup-infrastructure introduced — the proof is data flow (info travels with the event), not type-level wizardry. |

---

## Implementation impact (what the follow-up wave touches)

This spec ships only the design doc. The implementation wave (next session via writing-plans → agent pipeline) lands these changes atomically:

| File | Change |
|---|---|
| `src/features/scene/types/planet.ts` | **New.** `PlanetConfig` ( `color` + `placement` ). |
| `src/features/scene/types/period.ts` | **New.** `Month`, `YearMonth`, `Period`. |
| `src/features/scene/types/company-info.ts` | **New.** `CompanyInfo`. |
| `src/features/scene/types/reveal-projection.ts` | **New.** `RevealProjection` (discriminated `hidden \| visible`). |
| `src/features/scene/types/projections.ts` | **New.** `PlanetProjection`, `LabelProjection` (consumer-port narrow projections). |
| `src/features/scene/types/company.ts` | **Extended.** Add `CompanyEntry`; remove old `Company` type. |
| `src/features/scene/types/company.test.ts` | **Unchanged.** Existing `CompanyId` grep invariants continue to pass. |
| `src/features/scene/types/scene-event.ts` | **Updated.** `entered_proximity` carries `info` and `placement`; `exited_proximity` stays id-only. |
| `src/features/scene/widget/scene/companies.ts` | **Rewritten.** 5 `CompanyEntry` entries (Mave, 8fig, Riverside, StreamElements, TGS) replacing 8 foundation stubs. |
| `src/features/scene/widget/scene/companies.test.ts` | **New.** Sanity test for `getCompanyEntries()` — 5 entries, unique ids, non-empty info fields, period ordering. |
| `src/features/scene/widget/scene/useScene.ts` | **Updated.** Reads `CompanyEntry[]`, exposes `entries` + `revealProjection`, manages reveal projection from `SceneEvent` stream. |
| `src/features/scene/widget/scene/useScene.smoke.test.ts` | **Updated.** Assertions use the new return shape (`entries` instead of `companies`; `revealProjection` present). |
| `src/features/scene/widget/scene/SceneWidget.tsx` | **Updated.** Threads the new `useScene` fields into `<Scene />`. |
| `src/features/scene/services/renderer/proximityCheck.ts` | **Updated.** Generic signature `<T extends { placement }>(player, targets, radius) → ReadonlyArray<T>`. Math unchanged. |
| `src/features/scene/services/renderer/proximityCheck.test.ts` | **Updated.** Test fixtures use the generic shape; existing scenarios reuse the new return type. |
| `src/features/scene/components/Scene/Companies.tsx` | **Rewritten.** Consumes `PlanetProjection[]`; delegates to `<Planet />` child (one element per planet). Replaces the placeholder cube + HSL-from-id stub. |
| `src/features/scene/components/Scene/Planet.tsx` | **New.** Single-planet 3D sphere renderer (`sphereGeometry` + `meshStandardMaterial`) tinted by `planet.color`, with a slow Y-axis rotation driven by `useFrame`. |
| `src/features/scene/components/Scene/PlanetLabels.tsx` | **New.** Renders always-visible name + logo above each planet, anchored to `placement` (drei `<Html>`). |
| `src/features/scene/components/Scene/RevealOverlay.tsx` | **Updated.** Prop type changes from `{ objectId }` to `{ info, placement }`. Renders a basic info card (drei `<Html>`); polish lands later. |
| `src/features/scene/components/Scene/Scene.tsx` | **Updated.** New prop shape (`state`, `entries`, `intents`, `onEvent`, `revealProjection`); internally projects `planets` + `labels` via `useMemo` and distributes to children. |
| `src/features/scene/components/Scene/ProximityWatcher.tsx` | **Updated.** Iterates `CompanyEntry[]` directly via `proximityCheck`; emits `entered_proximity` with `info` + `placement` attached. |
| `src/features/scene/components/Scene/Scene.test.tsx` | **Updated.** Test fixtures use `CompanyEntry` + new prop shape. |
| `public/logos/*.svg` | **New (out of band).** Logo files for 5 companies. Acquired by the author; the data references `/logos/<id>.svg` paths. |

The implementation plan (writing-plans output) sequences these into a working order and assigns agents.

---

## Out of scope

- 3D planet assets (GLB or PBR-textured spheres) — interim rendering uses a colored 3D sphere per company. The real assets land in a follow-up wave that replaces `PlanetConfig.color` with an asset reference and rewrites `Planet.tsx`.
- Logo asset files (acquired separately by the author).
- Reveal overlay UI layout, typography, animation.
- Label rendering technique (drei `<Text>` SDF vs `<Html>` overlay) — chosen during implementation.
- Planet visual variation beyond per-company color (scale, axial tilt, atmosphere ring, glow).
- FSM changes — none needed.
- Parsing layer for externalized resume data — added if/when the data leaves source.
- Localization of company/role/description text.
- Mobile/touch input.

---

## Resume data — appendix

The 5 companies and their content, transcribed from `public/resume.pdf`. The implementation wave populates `companies.ts` with these as `CompanyEntry` literals.

### Mave

- **role:** `Head of Platform`
- **period:** `{ kind: 'ongoing', start: { year: 2025, month: 1 } }`
- **description:** Employee #1, responsible for building the company's end-to-end product execution pipeline from ideation to production. Built the platform from scratch while defining the architecture, standards, and practices behind it. Partnered across product, design, R&D, and QA to drive technical decisions and scalable execution.

### 8fig

- **role:** `Software Architect`
- **period:** `{ kind: 'closed', start: { year: 2023, month: 7 }, end: { year: 2025, month: 1 } }`
- **description:** Owned critical product systems end to end, building the company's design system and turning ambiguous ideas into production-ready features. Re-architected the back-office platform and rebuilt the main dashboard, reducing load times from 8+ seconds to near-instant. Also set frontend quality standards, mentored engineers, and shaped the engineering interview process.

### Riverside

- **role:** `Group Lead`
- **period:** `{ kind: 'closed', start: { year: 2022, month: 5 }, end: { year: 2023, month: 4 } }`
- **description:** Joined as the sole engineer on the Editor team and rebuilt a neglected product from scratch, creating a stable foundation for scale. Partnered with leadership on the roadmap and long-term vision, and introduced a clear workflow for feature scoping, delivery, and approval across teams. Also built the engineering interview process and served as technical and execution lead as the product scaled from roughly 100 users to nearly 1M.

### StreamElements

- **role:** `Senior Frontend Engineer`
- **period:** `{ kind: 'closed', start: { year: 2019, month: 10 }, end: { year: 2022, month: 5 } }`
- **description:** Early engineer during the company's formative stage, building multiple products from scratch and leading rapid pivots as market conditions and priorities changed. During COVID-19, remained the sole engineer in the department after a major downsizing and owned critical initiatives during a high-pressure period. That work became foundational to the company's later growth, scale, and $100M SoftBank investment.

### TGS

- **role:** `Frontend Engineer`
- **period:** `{ kind: 'closed', start: { year: 2018, month: 5 }, end: { year: 2019, month: 10 } }`
- **description:** Frontend engineer on a complex, high-traffic travel engine used by major airline customers, including EasyJet and Singapore Airlines. Built a white-label frontend architecture for multiple enterprise clients.

---

## Glossary

- **CompanyEntry** — the composite root: identity + planet visual + info content. One per company.
- **CompanyInfo** — info content (name, logo, role, period, description). One per CompanyEntry.
- **PlanetConfig** — visual config (color, placement). One per CompanyEntry.
- **Period** — discriminated union: `closed` (start + end) or `ongoing` (start only).
- **YearMonth** — `{ year, month }` with `month: Month` (literal union `1 | … | 12`).
- **Month** — closed literal union `1 | 2 | … | 12`. Used in `YearMonth`.
- **PlanetProjection / LabelProjection** — consumer-port narrow projections of `CompanyEntry`.
- **RevealProjection** — widget-side discriminated state (`hidden \| visible`) fed by the `SceneEvent` stream; supplies the reveal renderer with `info` + `placement` without a downstream lookup.
