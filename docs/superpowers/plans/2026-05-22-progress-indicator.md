# Progress Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slim, left-edge, vertically-centered HUD card (`features/progress/`) that surfaces per-planet exploration state (visited / here / unvisited), a counter `NN / 05`, a headline planet avatar (rotating), and a gentle dopamine choreography on every first visit (pip wake → 3 ripples → counter flip → card-border swell), with a green variant on route-complete and a persistent breathing border thereafter.

**Architecture:** New vertical slice `src/features/progress/` with the standard four-layer shape: pure `types/`, pure projections under `widget/card/`, pure UI in `components/ProgressCard/`, and a composition-root `widget/card/ProgressCardWidget.tsx`. Wired into the scene from `features/scene/widget/scene/SceneWidget.tsx`. No core changes — the projection is a pure transformation of `(sceneState, visited, route)` which already exist in `sceneMachine`.

**Tech Stack:** TypeScript (strictest config, no suppressors), React 19, `@react-three/fiber` + `@react-three/drei` (planet avatars), Vitest + jsdom (tests), `@testing-library/react`, Tailwind v4 + custom keyframes in `src/styles/globals.css`, `Geist Variable` + `Geist Mono Variable` fonts (already imported).

**Spec:** `docs/superpowers/specs/2026-05-22-progress-indicator-design.md` — read in full before starting Task 1.

**Task structure:** Bottom-up TDD. Domain types first (Task 1). Pure projections one by one (Tasks 2–5). Pure UI components in dependency order: leaf primitives first, then headline, then card (Tasks 6–12). Widget hook (Task 13). Widget shell (Task 14). CSS keyframes (Task 15). Scene wiring (Task 16). Manual browser smoke test (Task 17). At every task boundary the codebase typechecks and all tests pass (`pnpm check`).

**Cross-feature imports introduced by this plan (all are existing public-facing types/services in the scene/comms features):**

- From `features/scene/types/`: `SceneState`, `PausedResume`, `CompanyId`, `CompanyEntry`, `PlanetAssetId`, `PlanetConfig`.
- From `features/scene/widget/scene/companies.ts`: `CAREER_ROUTE`.
- From `features/scene/services/renderer/planetAssets.ts`: `PLANET_PATHS`, `COLORSHEET_PATH`, `configureColorsheet`, `resolvePlanetLook`.
- From `features/scene/services/renderer/planetVisualPlan.ts`: `cloneAndDress`.
- From `features/scene/services/renderer/planetPose.ts`: `planetPoseFor`.
- From `features/scene/services/renderer/planetPreviewFit.ts`: `computePlanetPreviewFit`.
- From `features/scene/services/renderer/planetAnimation.ts`: `animatePulse`.
- From `features/comms/types/motion-preference.ts`: `MotionPreference`.
- From `features/comms/services/prefersReducedMotion.ts`: `subscribePrefersReducedMotion`.

None of these reach into another feature's internals — they're the existing port-surfaces of the scene + comms features.

---

## Task 1: Domain types

Define every type the feature consumes: `ShortCode`, `Headline`, `Pip`, `StatusLabel`, `Counter`, `ProgressProjection`, `VisitEvent`, and `ProgressVisibility`. No logic. No tests (types only; structural correctness is the test).

**Files:**
- Create: `src/features/progress/types/short-code.ts`
- Create: `src/features/progress/types/headline.ts`
- Create: `src/features/progress/types/pip.ts`
- Create: `src/features/progress/types/status-label.ts`
- Create: `src/features/progress/types/counter.ts`
- Create: `src/features/progress/types/progress-projection.ts`
- Create: `src/features/progress/types/visit-event.ts`
- Create: `src/features/progress/types/progress-visibility.ts`

- [ ] **Step 1: Create short-code.ts**

Create `src/features/progress/types/short-code.ts`:

```typescript
export type ShortCode = string & { readonly __brand: 'ShortCode' };

export const asShortCode = (raw: string): ShortCode => raw as ShortCode;
```

- [ ] **Step 2: Create headline.ts**

Create `src/features/progress/types/headline.ts`:

```typescript
import type { CompanyId } from '../../scene/types/company';
import type { PlanetAssetId } from '../../scene/types/planet';
import type { ShortCode } from './short-code';

export type HeadlineCompany = {
  readonly id: CompanyId;
  readonly assetId: PlanetAssetId;
  readonly shortCode: ShortCode;
};

export type Headline =
  | { readonly kind: 'empty' }
  | { readonly kind: 'anchor'; readonly company: HeadlineCompany }
  | { readonly kind: 'active'; readonly company: HeadlineCompany }
  | { readonly kind: 'complete'; readonly company: HeadlineCompany };
```

- [ ] **Step 3: Create pip.ts**

Create `src/features/progress/types/pip.ts`:

```typescript
import type { CompanyId } from '../../scene/types/company';
import type { PlanetAssetId } from '../../scene/types/planet';

export type Pip =
  | { readonly kind: 'unvisited'; readonly companyId: CompanyId; readonly assetId: PlanetAssetId }
  | { readonly kind: 'visited'; readonly companyId: CompanyId; readonly assetId: PlanetAssetId }
  | { readonly kind: 'here'; readonly companyId: CompanyId; readonly assetId: PlanetAssetId };
```

- [ ] **Step 4: Create status-label.ts**

Create `src/features/progress/types/status-label.ts`:

```typescript
export type StatusLabel =
  | { readonly kind: 'standby' }
  | { readonly kind: 'active' }
  | { readonly kind: 'last_explored' }
  | { readonly kind: 'route_complete' };
```

- [ ] **Step 5: Create counter.ts**

Create `src/features/progress/types/counter.ts`:

```typescript
export type Counter =
  | { readonly kind: 'idle'; readonly visited: number; readonly total: number }
  | { readonly kind: 'complete'; readonly total: number };
```

- [ ] **Step 6: Create progress-projection.ts**

Create `src/features/progress/types/progress-projection.ts`:

```typescript
import type { Counter } from './counter';
import type { Headline } from './headline';
import type { Pip } from './pip';
import type { StatusLabel } from './status-label';

export type PipTuple = readonly [Pip, Pip, Pip, Pip, Pip];

export type ProgressProjection = {
  readonly headline: Headline;
  readonly status: StatusLabel;
  readonly counter: Counter;
  readonly pips: PipTuple;
};
```

- [ ] **Step 7: Create visit-event.ts**

Create `src/features/progress/types/visit-event.ts`:

```typescript
import type { CompanyId } from '../../scene/types/company';
import type { PlanetAssetId } from '../../scene/types/planet';

export type VisitEvent =
  | {
      readonly kind: 'first_visit';
      readonly companyId: CompanyId;
      readonly assetId: PlanetAssetId;
    }
  | {
      readonly kind: 'route_complete';
      readonly companyId: CompanyId;
      readonly assetId: PlanetAssetId;
    }
  | {
      readonly kind: 'revisit';
      readonly companyId: CompanyId;
      readonly assetId: PlanetAssetId;
    }
  | {
      readonly kind: 'depart';
      readonly companyId: CompanyId;
      readonly assetId: PlanetAssetId;
    };
```

- [ ] **Step 8: Create progress-visibility.ts**

Create `src/features/progress/types/progress-visibility.ts`:

```typescript
export type ProgressVisibility =
  | { readonly kind: 'visible' }
  | { readonly kind: 'hidden' };
```

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`
Expected: exits 0, no errors.

- [ ] **Step 10: Commit**

```bash
git add src/features/progress/types/
git commit -m "progress: domain types skeleton"
```

---

## Task 2: Short codes lookup

Define the `COMPANY_SHORT_CODES` lookup map and its accompanying lookup helper, plus a test covering each company and the totality of the route. The lookup is total — it returns `ShortCode`, never `ShortCode | undefined`.

**Files:**
- Create: `src/features/progress/widget/card/shortCodes.ts`
- Create: `src/features/progress/widget/card/shortCodes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/widget/card/shortCodes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { asCompanyId, type CompanyId } from '../../../scene/types/company';
import { CAREER_ROUTE } from '../../../scene/widget/scene/companies';
import { asShortCode } from '../../types/short-code';
import { COMPANY_SHORT_CODES, shortCodeFor } from './shortCodes';

describe('COMPANY_SHORT_CODES', () => {
  it('maps mave to MAV', () => {
    expect(COMPANY_SHORT_CODES[asCompanyId('mave')]).toBe(asShortCode('MAV'));
  });

  it('maps 8fig to 8FG', () => {
    expect(COMPANY_SHORT_CODES[asCompanyId('8fig')]).toBe(asShortCode('8FG'));
  });

  it('maps riverside to RVS', () => {
    expect(COMPANY_SHORT_CODES[asCompanyId('riverside')]).toBe(asShortCode('RVS'));
  });

  it('maps streamelements to STE', () => {
    expect(COMPANY_SHORT_CODES[asCompanyId('streamelements')]).toBe(asShortCode('STE'));
  });

  it('maps tgs to TGS', () => {
    expect(COMPANY_SHORT_CODES[asCompanyId('tgs')]).toBe(asShortCode('TGS'));
  });

  it('has an entry for every company in CAREER_ROUTE', () => {
    for (const entry of CAREER_ROUTE) {
      const code: string = COMPANY_SHORT_CODES[entry.id];
      expect(code.length).toBeGreaterThan(0);
    }
  });
});

describe('shortCodeFor', () => {
  it('returns the matching ShortCode for a CompanyId in the lookup', () => {
    const id: CompanyId = asCompanyId('riverside');
    expect(shortCodeFor(id)).toBe(asShortCode('RVS'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/widget/card/shortCodes.test.ts`
Expected: FAIL with module-not-found / undefined-import errors.

- [ ] **Step 3: Implement shortCodes.ts**

Create `src/features/progress/widget/card/shortCodes.ts`:

```typescript
import { asCompanyId, type CompanyId } from '../../../scene/types/company';
import { asShortCode, type ShortCode } from '../../types/short-code';

export const COMPANY_SHORT_CODES: Readonly<Record<CompanyId, ShortCode>> = {
  [asCompanyId('mave')]: asShortCode('MAV'),
  [asCompanyId('8fig')]: asShortCode('8FG'),
  [asCompanyId('riverside')]: asShortCode('RVS'),
  [asCompanyId('streamelements')]: asShortCode('STE'),
  [asCompanyId('tgs')]: asShortCode('TGS'),
};

export const shortCodeFor = (id: CompanyId): ShortCode => COMPANY_SHORT_CODES[id];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/widget/card/shortCodes.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/widget/card/shortCodes.ts src/features/progress/widget/card/shortCodes.test.ts
git commit -m "progress: company short codes lookup"
```

---

## Task 3: Visibility projection

Mirror `features/comms/widget/dock/projectDockVisibility.ts` for the progress card. Pure function: `SceneState → ProgressVisibility`. `loading` is hidden, everything else is visible.

**Files:**
- Create: `src/features/progress/widget/card/projectVisibility.ts`
- Create: `src/features/progress/widget/card/projectVisibility.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/widget/card/projectVisibility.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../../scene/types/company';
import type { SceneState } from '../../../scene/types/scene-state';
import { projectVisibility } from './projectVisibility';

describe('projectVisibility', () => {
  it('is "visible" when scene is playing', () => {
    const state: SceneState = { kind: 'playing' };
    expect(projectVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is "visible" when scene is revealing', () => {
    const state: SceneState = { kind: 'revealing', objectId: asCompanyId('mave') };
    expect(projectVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is "visible" when scene is paused resuming to playing', () => {
    const state: SceneState = { kind: 'paused', resumeTo: { kind: 'playing' } };
    expect(projectVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is "visible" when scene is paused resuming to revealing', () => {
    const state: SceneState = {
      kind: 'paused',
      resumeTo: { kind: 'revealing', objectId: asCompanyId('riverside') },
    };
    expect(projectVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is "hidden" when scene is loading', () => {
    const state: SceneState = { kind: 'loading' };
    expect(projectVisibility(state)).toEqual({ kind: 'hidden' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/widget/card/projectVisibility.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement projectVisibility.ts**

Create `src/features/progress/widget/card/projectVisibility.ts`:

```typescript
import type { SceneState } from '../../../scene/types/scene-state';
import type { ProgressVisibility } from '../../types/progress-visibility';

export const projectVisibility = (state: SceneState): ProgressVisibility => {
  switch (state.kind) {
    case 'loading':
      return { kind: 'hidden' };
    case 'playing':
    case 'revealing':
    case 'paused':
      return { kind: 'visible' };
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/widget/card/projectVisibility.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/widget/card/projectVisibility.ts src/features/progress/widget/card/projectVisibility.test.ts
git commit -m "progress: visibility projection"
```

---

## Task 4: Progress projection

The main pure projection: `(sceneState, visited, route) → ProgressProjection`. Tests cover every state in the spec's table: pre-route, mid-route with anchor, in proximity, complete free-roam, complete during re-reveal, out-of-order visits, paused-resume branches.

**Files:**
- Create: `src/features/progress/widget/card/projectProgress.ts`
- Create: `src/features/progress/widget/card/projectProgress.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/widget/card/projectProgress.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { asCompanyId, type CompanyEntry } from '../../../scene/types/company';
import type { PlanetAssetId } from '../../../scene/types/planet';
import type { SceneState } from '../../../scene/types/scene-state';
import { asShortCode } from '../../types/short-code';
import { projectProgress } from './projectProgress';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

const placement = (z: number): readonly [number, number, number] => [0, 0, z];

const entryFor = (id: CompanyEntry['id'], assetId: PlanetAssetId, z: number): CompanyEntry => ({
  id,
  planet: { assetId, placement: placement(z) },
  info: {
    companyName: 'X',
    logo: { kind: 'no_icon' },
    website: { kind: 'no_website' },
    role: 'X',
    period: { kind: 'ongoing', start: { year: 2020, month: 1 } },
    oneLiner: 'X',
    hook: 'X',
    decision: { kind: 'none' },
    work: ['X'],
    departure: { kind: 'current_role' },
  },
});

const ROUTE: readonly [
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
] = [
  entryFor(mave, 'saturn_b', 70),
  entryFor(eightfig, 'jupiter_b', 170),
  entryFor(riverside, 'mars_b', 250),
  entryFor(streamelements, 'earth_b', 325),
  entryFor(tgs, 'venus_b', 395),
];

describe('projectProgress', () => {
  it('returns empty headline + standby + idle 0/5 + all unvisited when nothing visited and scene playing', () => {
    const state: SceneState = { kind: 'playing' };
    const projection = projectProgress(state, [], ROUTE);

    expect(projection.headline).toEqual({ kind: 'empty' });
    expect(projection.status).toEqual({ kind: 'standby' });
    expect(projection.counter).toEqual({ kind: 'idle', visited: 0, total: 5 });
    expect(projection.pips.every((p) => p.kind === 'unvisited')).toBe(true);
  });

  it('returns anchor headline + last_explored + idle 1/5 with one visited (free-roaming)', () => {
    const state: SceneState = { kind: 'playing' };
    const projection = projectProgress(state, [mave], ROUTE);

    expect(projection.headline).toEqual({
      kind: 'anchor',
      company: { id: mave, assetId: 'saturn_b', shortCode: asShortCode('MAV') },
    });
    expect(projection.status).toEqual({ kind: 'last_explored' });
    expect(projection.counter).toEqual({ kind: 'idle', visited: 1, total: 5 });
    expect(projection.pips[0].kind).toBe('visited');
    expect(projection.pips[1].kind).toBe('unvisited');
  });

  it('anchor headline is the last-visited (not the most-recent-route) — out-of-order visits', () => {
    const state: SceneState = { kind: 'playing' };
    const projection = projectProgress(state, [mave, streamelements], ROUTE);

    expect(projection.headline.kind).toBe('anchor');
    if (projection.headline.kind !== 'anchor') throw new Error('expected anchor');
    expect(projection.headline.company.id).toBe(streamelements);
    expect(projection.counter).toEqual({ kind: 'idle', visited: 2, total: 5 });
    expect(projection.pips[0].kind).toBe('visited');
    expect(projection.pips[3].kind).toBe('visited');
    expect(projection.pips[1].kind).toBe('unvisited');
  });

  it('returns active headline + active + idle when revealing a planet not yet in visited', () => {
    const state: SceneState = { kind: 'revealing', objectId: riverside };
    const projection = projectProgress(state, [mave], ROUTE);

    expect(projection.headline).toEqual({
      kind: 'active',
      company: { id: riverside, assetId: 'mars_b', shortCode: asShortCode('RVS') },
    });
    expect(projection.status).toEqual({ kind: 'active' });
    expect(projection.counter).toEqual({ kind: 'idle', visited: 1, total: 5 });
    expect(projection.pips[0].kind).toBe('visited');
    expect(projection.pips[2].kind).toBe('here');
  });

  it('returns active headline + active when re-revealing an already-visited planet (revisit)', () => {
    const state: SceneState = { kind: 'revealing', objectId: mave };
    const projection = projectProgress(state, [mave, eightfig, mave], ROUTE);

    expect(projection.headline.kind).toBe('active');
    if (projection.headline.kind !== 'active') throw new Error('expected active');
    expect(projection.headline.company.id).toBe(mave);
    expect(projection.pips[0].kind).toBe('here');
    expect(projection.pips[1].kind).toBe('visited');
  });

  it('returns complete headline + route_complete + complete counter when all 5 visited and playing', () => {
    const state: SceneState = { kind: 'playing' };
    const projection = projectProgress(
      state,
      [mave, eightfig, riverside, streamelements, tgs],
      ROUTE,
    );

    expect(projection.headline.kind).toBe('complete');
    if (projection.headline.kind !== 'complete') throw new Error('expected complete');
    expect(projection.headline.company.id).toBe(tgs);
    expect(projection.status).toEqual({ kind: 'route_complete' });
    expect(projection.counter).toEqual({ kind: 'complete', total: 5 });
    expect(projection.pips.every((p) => p.kind === 'visited')).toBe(true);
  });

  it('counter stays "complete" even when re-revealing after route completion (active overlay layered)', () => {
    const state: SceneState = { kind: 'revealing', objectId: riverside };
    const projection = projectProgress(
      state,
      [mave, eightfig, riverside, streamelements, tgs, riverside],
      ROUTE,
    );

    expect(projection.counter).toEqual({ kind: 'complete', total: 5 });
    expect(projection.status).toEqual({ kind: 'active' });
    expect(projection.headline.kind).toBe('active');
  });

  it('paused-resume-to-playing projects the same shape as playing with same visited', () => {
    const state: SceneState = { kind: 'paused', resumeTo: { kind: 'playing' } };
    const projection = projectProgress(state, [mave, eightfig], ROUTE);

    expect(projection.headline.kind).toBe('anchor');
    if (projection.headline.kind !== 'anchor') throw new Error('expected anchor');
    expect(projection.headline.company.id).toBe(eightfig);
    expect(projection.status).toEqual({ kind: 'last_explored' });
  });

  it('paused-resume-to-revealing projects the same shape as revealing with same visited', () => {
    const state: SceneState = {
      kind: 'paused',
      resumeTo: { kind: 'revealing', objectId: tgs },
    };
    const projection = projectProgress(state, [mave], ROUTE);

    expect(projection.headline.kind).toBe('active');
    if (projection.headline.kind !== 'active') throw new Error('expected active');
    expect(projection.headline.company.id).toBe(tgs);
    expect(projection.status).toEqual({ kind: 'active' });
    expect(projection.pips[4].kind).toBe('here');
  });

  it('loading state still returns a well-formed projection (caller handles visibility)', () => {
    const state: SceneState = { kind: 'loading' };
    const projection = projectProgress(state, [], ROUTE);

    expect(projection.headline).toEqual({ kind: 'empty' });
    expect(projection.status).toEqual({ kind: 'standby' });
    expect(projection.counter).toEqual({ kind: 'idle', visited: 0, total: 5 });
  });

  it('pips are always returned in canonical career order regardless of visit order', () => {
    const state: SceneState = { kind: 'playing' };
    const visited = [tgs, streamelements, mave]; // out-of-order visits
    const projection = projectProgress(state, visited, ROUTE);

    expect(projection.pips[0].companyId).toBe(mave);
    expect(projection.pips[1].companyId).toBe(eightfig);
    expect(projection.pips[2].companyId).toBe(riverside);
    expect(projection.pips[3].companyId).toBe(streamelements);
    expect(projection.pips[4].companyId).toBe(tgs);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/widget/card/projectProgress.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement projectProgress.ts**

Create `src/features/progress/widget/card/projectProgress.ts`:

```typescript
import type { CompanyEntry, CompanyId } from '../../../scene/types/company';
import type { PausedResume, SceneState } from '../../../scene/types/scene-state';
import type { Counter } from '../../types/counter';
import type { Headline, HeadlineCompany } from '../../types/headline';
import type { Pip, PipTuple } from '../../types/pip';
import type { ProgressProjection } from '../../types/progress-projection';
import type { StatusLabel } from '../../types/status-label';

type Route = readonly [CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry];

type ActiveView =
  | { readonly kind: 'no_active' }
  | { readonly kind: 'active'; readonly objectId: CompanyId };

const activeViewOf = (state: SceneState): ActiveView => {
  switch (state.kind) {
    case 'revealing':
      return { kind: 'active', objectId: state.objectId };
    case 'paused':
      return activeViewFromPaused(state.resumeTo);
    case 'playing':
    case 'loading':
      return { kind: 'no_active' };
  }
};

const activeViewFromPaused = (resumeTo: PausedResume): ActiveView => {
  switch (resumeTo.kind) {
    case 'revealing':
      return { kind: 'active', objectId: resumeTo.objectId };
    case 'playing':
      return { kind: 'no_active' };
  }
};

const headlineCompanyFor = (entry: CompanyEntry): HeadlineCompany => ({
  id: entry.id,
  assetId: entry.planet.assetId,
  shortCode: entry.shortCode,
});

const lookupEntry = (route: Route, id: CompanyId): CompanyEntry | null => {
  for (const entry of route) {
    if (entry.id === id) return entry;
  }
  return null;
};

const lastVisitedEntry = (
  visited: ReadonlyArray<CompanyId>,
  route: Route,
): CompanyEntry | null => {
  for (let i = visited.length - 1; i >= 0; i--) {
    const id = visited[i];
    if (id === undefined) continue;
    const entry = lookupEntry(route, id);
    if (entry !== null) return entry;
  }
  return null;
};

const headlineFor = (
  state: SceneState,
  visited: ReadonlyArray<CompanyId>,
  route: Route,
): Headline => {
  const active = activeViewOf(state);
  if (active.kind === 'active') {
    const entry = lookupEntry(route, active.objectId);
    if (entry === null) return { kind: 'empty' };
    return { kind: 'active', company: headlineCompanyFor(entry) };
  }
  const last = lastVisitedEntry(visited, route);
  if (last === null) return { kind: 'empty' };
  const visitedSet = new Set(visited);
  const allVisited = route.every((entry) => visitedSet.has(entry.id));
  return {
    kind: allVisited ? 'complete' : 'anchor',
    company: headlineCompanyFor(last),
  };
};

const statusFor = (headline: Headline): StatusLabel => {
  switch (headline.kind) {
    case 'empty':
      return { kind: 'standby' };
    case 'active':
      return { kind: 'active' };
    case 'anchor':
      return { kind: 'last_explored' };
    case 'complete':
      return { kind: 'route_complete' };
  }
};

const counterFor = (visited: ReadonlyArray<CompanyId>, route: Route): Counter => {
  const visitedSet = new Set(visited);
  let count = 0;
  for (const entry of route) {
    if (visitedSet.has(entry.id)) count++;
  }
  const total = route.length;
  if (count === total) return { kind: 'complete', total };
  return { kind: 'idle', visited: count, total };
};

const pipFor = (
  entry: CompanyEntry,
  visitedSet: ReadonlySet<CompanyId>,
  activeId: CompanyId | null,
): Pip => {
  if (activeId !== null && entry.id === activeId) {
    return { kind: 'here', companyId: entry.id, assetId: entry.planet.assetId };
  }
  if (visitedSet.has(entry.id)) {
    return { kind: 'visited', companyId: entry.id, assetId: entry.planet.assetId };
  }
  return { kind: 'unvisited', companyId: entry.id, assetId: entry.planet.assetId };
};

const pipsFor = (
  state: SceneState,
  visited: ReadonlyArray<CompanyId>,
  route: Route,
): PipTuple => {
  const active = activeViewOf(state);
  const activeId = active.kind === 'active' ? active.objectId : null;
  const visitedSet = new Set(visited);
  return [
    pipFor(route[0], visitedSet, activeId),
    pipFor(route[1], visitedSet, activeId),
    pipFor(route[2], visitedSet, activeId),
    pipFor(route[3], visitedSet, activeId),
    pipFor(route[4], visitedSet, activeId),
  ];
};

export const projectProgress = (
  state: SceneState,
  visited: ReadonlyArray<CompanyId>,
  route: Route,
): ProgressProjection => {
  const headline = headlineFor(state, visited, route);
  return {
    headline,
    status: statusFor(headline),
    counter: counterFor(visited, route),
    pips: pipsFor(state, visited, route),
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/widget/card/projectProgress.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/widget/card/projectProgress.ts src/features/progress/widget/card/projectProgress.test.ts
git commit -m "progress: projection from (state, visited, route)"
```

---

## Task 5: Visit event detection

Pure diff function: `(prev, next) → VisitEvent | null`. Detects which transition fired between two consecutive projections.

**Files:**
- Create: `src/features/progress/widget/card/detectVisitEvents.ts`
- Create: `src/features/progress/widget/card/detectVisitEvents.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/widget/card/detectVisitEvents.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../../scene/types/company';
import type { Pip, PipTuple } from '../../types/pip';
import type { ProgressProjection } from '../../types/progress-projection';
import { detectVisitEvents } from './detectVisitEvents';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

const u = (id: typeof mave, asset: 'saturn_b' | 'jupiter_b' | 'mars_b' | 'earth_b' | 'venus_b'): Pip => ({
  kind: 'unvisited',
  companyId: id,
  assetId: asset,
});
const v = (id: typeof mave, asset: 'saturn_b' | 'jupiter_b' | 'mars_b' | 'earth_b' | 'venus_b'): Pip => ({
  kind: 'visited',
  companyId: id,
  assetId: asset,
});
const h = (id: typeof mave, asset: 'saturn_b' | 'jupiter_b' | 'mars_b' | 'earth_b' | 'venus_b'): Pip => ({
  kind: 'here',
  companyId: id,
  assetId: asset,
});

const tuple = (a: Pip, b: Pip, c: Pip, d: Pip, e: Pip): PipTuple => [a, b, c, d, e];

const makeProjection = (
  pips: PipTuple,
  visited: number,
  isComplete: boolean,
): ProgressProjection => ({
  headline: { kind: 'empty' },
  status: { kind: 'standby' },
  counter: isComplete ? { kind: 'complete', total: 5 } : { kind: 'idle', visited, total: 5 },
  pips,
});

describe('detectVisitEvents', () => {
  it('returns null when projections are identical', () => {
    const projection = makeProjection(
      tuple(
        u(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      0,
      false,
    );
    expect(detectVisitEvents(projection, projection)).toBeNull();
  });

  it('returns first_visit when a pip went unvisited → here', () => {
    const prev = makeProjection(
      tuple(
        u(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      0,
      false,
    );
    const next = makeProjection(
      tuple(
        h(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      0,
      false,
    );
    expect(detectVisitEvents(prev, next)).toEqual({
      kind: 'first_visit',
      companyId: mave,
      assetId: 'saturn_b',
    });
  });

  it('returns route_complete when the 5th pip becomes here and counter completes', () => {
    const prev = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        v(eightfig, 'jupiter_b'),
        v(riverside, 'mars_b'),
        v(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      4,
      false,
    );
    const next = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        v(eightfig, 'jupiter_b'),
        v(riverside, 'mars_b'),
        v(streamelements, 'earth_b'),
        h(tgs, 'venus_b'),
      ),
      4,
      true,
    );
    expect(detectVisitEvents(prev, next)).toEqual({
      kind: 'route_complete',
      companyId: tgs,
      assetId: 'venus_b',
    });
  });

  it('returns revisit when a pip went visited → here', () => {
    const prev = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    const next = makeProjection(
      tuple(
        h(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    expect(detectVisitEvents(prev, next)).toEqual({
      kind: 'revisit',
      companyId: mave,
      assetId: 'saturn_b',
    });
  });

  it('returns depart when a pip went here → visited', () => {
    const prev = makeProjection(
      tuple(
        h(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    const next = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    expect(detectVisitEvents(prev, next)).toEqual({
      kind: 'depart',
      companyId: mave,
      assetId: 'saturn_b',
    });
  });

  it('returns first_visit for the new pip when proximity moves from one planet to a fresh one in one tick', () => {
    const prev = makeProjection(
      tuple(
        h(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    const next = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        h(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    const event = detectVisitEvents(prev, next);
    expect(event).toEqual({
      kind: 'first_visit',
      companyId: eightfig,
      assetId: 'jupiter_b',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/widget/card/detectVisitEvents.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement detectVisitEvents.ts**

Create `src/features/progress/widget/card/detectVisitEvents.ts`:

```typescript
import type { Pip, PipTuple } from '../../types/pip';
import type { ProgressProjection } from '../../types/progress-projection';
import type { VisitEvent } from '../../types/visit-event';

type Transition = {
  readonly index: number;
  readonly prev: Pip['kind'];
  readonly next: Pip['kind'];
  readonly pip: Pip;
};

const transitionsBetween = (prev: PipTuple, next: PipTuple): ReadonlyArray<Transition> => {
  const transitions: Transition[] = [];
  for (let i = 0; i < 5; i++) {
    const prevPip = prev[i];
    const nextPip = next[i];
    if (prevPip.kind !== nextPip.kind) {
      transitions.push({ index: i, prev: prevPip.kind, next: nextPip.kind, pip: nextPip });
    }
  }
  return transitions;
};

const firstVisitEvent = (
  pip: Pip,
  nextCounter: ProgressProjection['counter'],
): VisitEvent =>
  nextCounter.kind === 'complete'
    ? { kind: 'route_complete', companyId: pip.companyId, assetId: pip.assetId }
    : { kind: 'first_visit', companyId: pip.companyId, assetId: pip.assetId };

const eventForTransitions = (
  transitions: ReadonlyArray<Transition>,
  nextCounter: ProgressProjection['counter'],
): VisitEvent | null => {
  // Priority: a new "here" (first_visit/route_complete or revisit) outweighs
  // a depart (here→visited in the same tick).
  for (const t of transitions) {
    if (t.next === 'here' && t.prev === 'unvisited') {
      return firstVisitEvent(t.pip, nextCounter);
    }
    if (t.next === 'here' && t.prev === 'visited') {
      return { kind: 'revisit', companyId: t.pip.companyId, assetId: t.pip.assetId };
    }
  }
  for (const t of transitions) {
    if (t.prev === 'here' && t.next === 'visited') {
      return { kind: 'depart', companyId: t.pip.companyId, assetId: t.pip.assetId };
    }
  }
  return null;
};

export const detectVisitEvents = (
  prev: ProgressProjection,
  next: ProgressProjection,
): VisitEvent | null => {
  const transitions = transitionsBetween(prev.pips, next.pips);
  if (transitions.length === 0) return null;
  return eventForTransitions(transitions, next.counter);
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/widget/card/detectVisitEvents.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/widget/card/detectVisitEvents.ts src/features/progress/widget/card/detectVisitEvents.test.ts
git commit -m "progress: visit-event detection (pure diff on projections)"
```

---

## Task 6: StatusLabel component

Pure UI. Renders the uppercase status text given a `StatusLabel`. The displayed text and color are derived inside this component — no caller hands raw strings in.

**Files:**
- Create: `src/features/progress/components/ProgressCard/StatusLabel.tsx`
- Create: `src/features/progress/components/ProgressCard/StatusLabel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/components/ProgressCard/StatusLabel.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StatusLabel as StatusLabelValue } from '../../types/status-label';
import { StatusLabel } from './StatusLabel';

describe('StatusLabel', () => {
  it('renders STANDBY for standby kind', () => {
    const value: StatusLabelValue = { kind: 'standby' };
    render(<StatusLabel value={value} />);
    expect(screen.getByText('STANDBY')).toBeTruthy();
  });

  it('renders ACTIVE for active kind', () => {
    const value: StatusLabelValue = { kind: 'active' };
    render(<StatusLabel value={value} />);
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('renders LAST EXPLORED for last_explored kind', () => {
    const value: StatusLabelValue = { kind: 'last_explored' };
    render(<StatusLabel value={value} />);
    expect(screen.getByText('LAST EXPLORED')).toBeTruthy();
  });

  it('renders ROUTE COMPLETE for route_complete kind', () => {
    const value: StatusLabelValue = { kind: 'route_complete' };
    render(<StatusLabel value={value} />);
    expect(screen.getByText('ROUTE COMPLETE')).toBeTruthy();
  });

  it('exposes the kind as data-status on the root element', () => {
    const value: StatusLabelValue = { kind: 'active' };
    const { container } = render(<StatusLabel value={value} />);
    const root = container.querySelector('[data-status="active"]');
    expect(root).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/components/ProgressCard/StatusLabel.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement StatusLabel.tsx**

Create `src/features/progress/components/ProgressCard/StatusLabel.tsx`:

```typescript
import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { StatusLabel as StatusLabelValue } from '../../types/status-label';

type StatusLabelProps = {
  readonly value: StatusLabelValue;
};

const textFor = (value: StatusLabelValue): string => {
  switch (value.kind) {
    case 'standby':
      return 'STANDBY';
    case 'active':
      return 'ACTIVE';
    case 'last_explored':
      return 'LAST EXPLORED';
    case 'route_complete':
      return 'ROUTE COMPLETE';
  }
};

const COLOR_CLASSES: Readonly<Record<StatusLabelValue['kind'], string>> = {
  standby: 'text-foreground/30',
  active: 'text-(--color-accent)',
  last_explored: 'text-(--color-accent)',
  route_complete: 'text-[#7be0a2]',
};

const BASE_CLASSNAME = cn(
  'font-mono text-[7px] font-medium uppercase tracking-[0.22em]',
  'transition-colors duration-200',
);

export const StatusLabel = (props: StatusLabelProps): JSX.Element => (
  <span data-status={props.value.kind} className={cn(BASE_CLASSNAME, COLOR_CLASSES[props.value.kind])}>
    {textFor(props.value)}
  </span>
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/components/ProgressCard/StatusLabel.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/components/ProgressCard/StatusLabel.tsx src/features/progress/components/ProgressCard/StatusLabel.test.tsx
git commit -m "progress: StatusLabel component"
```

---

## Task 7: ProgressCounter component

Pure UI. Renders the `NN / NN` count with the right color per state. The component receives a `Counter` value and a `flipKey` token; when the flipKey changes, a brief glow CSS class is applied via a `data-flipping` attribute that the CSS keyframe targets.

**Files:**
- Create: `src/features/progress/components/ProgressCard/ProgressCounter.tsx`
- Create: `src/features/progress/components/ProgressCard/ProgressCounter.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/components/ProgressCard/ProgressCounter.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { Counter } from '../../types/counter';
import { ProgressCounter } from './ProgressCounter';

const queryNumbers = (container: HTMLElement): ReadonlyArray<string> => {
  const nodes = container.querySelectorAll('[data-count]');
  return Array.from(nodes).map((n) => n.textContent ?? '');
};

describe('ProgressCounter', () => {
  it('renders "00 / 05" when idle with 0 visited', () => {
    const counter: Counter = { kind: 'idle', visited: 0, total: 5 };
    const { container } = render(<ProgressCounter value={counter} flipKey={0} />);
    expect(queryNumbers(container)).toEqual(['00', '05']);
  });

  it('renders "02 / 05" when idle with 2 visited', () => {
    const counter: Counter = { kind: 'idle', visited: 2, total: 5 };
    const { container } = render(<ProgressCounter value={counter} flipKey={2} />);
    expect(queryNumbers(container)).toEqual(['02', '05']);
  });

  it('renders "05 / 05" when complete', () => {
    const counter: Counter = { kind: 'complete', total: 5 };
    const { container } = render(<ProgressCounter value={counter} flipKey={5} />);
    expect(queryNumbers(container)).toEqual(['05', '05']);
  });

  it('exposes data-state="idle" or data-state="complete" on the root', () => {
    const idle: Counter = { kind: 'idle', visited: 1, total: 5 };
    const { container: idleC } = render(<ProgressCounter value={idle} flipKey={1} />);
    expect(idleC.querySelector('[data-state="idle"]')).not.toBeNull();

    const complete: Counter = { kind: 'complete', total: 5 };
    const { container: completeC } = render(<ProgressCounter value={complete} flipKey={5} />);
    expect(completeC.querySelector('[data-state="complete"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/components/ProgressCard/ProgressCounter.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement ProgressCounter.tsx**

Create `src/features/progress/components/ProgressCard/ProgressCounter.tsx`:

```typescript
import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { Counter } from '../../types/counter';

type ProgressCounterProps = {
  readonly value: Counter;
  // Increments every time the counter ticks. When this prop changes, the
  // visited number plays a brief glow via a CSS keyframe keyed off the
  // attribute. Same value across renders = no animation.
  readonly flipKey: number;
};

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

const visitedNumber = (value: Counter): number => {
  switch (value.kind) {
    case 'idle':
      return value.visited;
    case 'complete':
      return value.total;
  }
};

const isComplete = (value: Counter): boolean => value.kind === 'complete';

const ROOT_CLASSNAME = cn(
  'flex items-baseline justify-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.14em]',
  'text-foreground/55',
);

const NUM_CLASSNAME = cn(
  'font-mono text-[10px] font-semibold tabular-nums',
  'transition-colors duration-300',
);

export const ProgressCounter = (props: ProgressCounterProps): JSX.Element => {
  const complete = isComplete(props.value);
  return (
    <div data-state={props.value.kind} className={ROOT_CLASSNAME}>
      <span
        data-count="visited"
        data-flipping={String(props.flipKey)}
        className={cn(
          NUM_CLASSNAME,
          complete ? 'text-[#7be0a2]' : 'text-(--color-accent)',
        )}
      >
        {pad2(visitedNumber(props.value))}
      </span>
      <span data-divider>/</span>
      <span
        data-count="total"
        className={cn(
          NUM_CLASSNAME,
          complete ? 'text-[#7be0a2]' : 'text-foreground/55',
        )}
      >
        {pad2(props.value.total)}
      </span>
    </div>
  );
};
```

The `data-count="visited"` and `data-count="total"` attributes are used by the tests AND by the future CSS keyframe `[data-flipping]` selector to drive the brief text-shadow glow during the flip.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/components/ProgressCard/ProgressCounter.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/components/ProgressCard/ProgressCounter.tsx src/features/progress/components/ProgressCard/ProgressCounter.test.tsx
git commit -m "progress: ProgressCounter component"
```

---

## Task 8: PlanetCanvas internal helper

Internal shared component for both `HeadlinePlanet` and `ProgressPip`. Wraps an `@react-three/fiber` Canvas, loads the GLTF via `useGLTF`, dresses it with the same renderer services that `PlanetPreview` already uses, and accepts a `rotates` prop controlling whether the local rotation tick runs. **Not exported outside `components/ProgressCard/`.**

Tests for this component are minimal — the Canvas content is WebGL (jsdom can't render it), so we test only that the wrapper renders the right `data-rotates` attribute. Visual correctness is verified manually in Task 17.

**Files:**
- Create: `src/features/progress/components/ProgressCard/PlanetCanvas.tsx`
- Create: `src/features/progress/components/ProgressCard/PlanetCanvas.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/components/ProgressCard/PlanetCanvas.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { PlanetCanvas } from './PlanetCanvas';

// jsdom doesn't support WebGL — stub @react-three/fiber's Canvas so we can
// at least mount the wrapper. We only test the wrapper attributes here.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { readonly children?: ReactNode }): JSX.Element => (
    <div data-test-canvas>{children}</div>
  ),
  useFrame: (): void => {},
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: (): unknown => ({}) } }),
  useTexture: () => ({}),
}));

describe('PlanetCanvas', () => {
  it('renders with data-rotates="true" when rotates=true', () => {
    const { container } = render(<PlanetCanvas assetId="mars_b" rotates={true} />);
    expect(container.querySelector('[data-rotates="true"]')).not.toBeNull();
  });

  it('renders with data-rotates="false" when rotates=false', () => {
    const { container } = render(<PlanetCanvas assetId="mars_b" rotates={false} />);
    expect(container.querySelector('[data-rotates="false"]')).not.toBeNull();
  });

  it('passes the assetId through as data-asset', () => {
    const { container } = render(<PlanetCanvas assetId="saturn_b" rotates={true} />);
    expect(container.querySelector('[data-asset="saturn_b"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/components/ProgressCard/PlanetCanvas.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement PlanetCanvas.tsx**

Create `src/features/progress/components/ProgressCard/PlanetCanvas.tsx`:

```typescript
import { useMemo, useRef, type JSX, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import type { Group, MeshStandardMaterial, Object3D } from 'three';
import { assetUrl } from '@/lib/assetUrl';
import type { PlanetAssetId } from '../../../scene/types/planet';
import {
  COLORSHEET_PATH,
  PLANET_PATHS,
  configureColorsheet,
  resolvePlanetLook,
} from '../../../scene/services/renderer/planetAssets';
import { cloneAndDress } from '../../../scene/services/renderer/planetVisualPlan';
import type { PulseSpec } from '../../../scene/services/renderer/planetTypes';
import { animatePulse } from '../../../scene/services/renderer/planetAnimation';
import { planetPoseFor } from '../../../scene/services/renderer/planetPose';
import type { PlanetPose } from '../../../scene/services/renderer/planetPose';
import { computePlanetPreviewFit } from '../../../scene/services/renderer/planetPreviewFit';
import type { PlanetPreviewFit } from '../../../scene/services/renderer/planetPreviewFit';

const ROTATION_RATE_RAD_PER_SEC = 0.6;
const KEY_COLOR = '#fff5e8';
const FILL_COLOR = '#a8d4ff';

type PlanetCanvasProps = {
  readonly assetId: PlanetAssetId;
  readonly rotates: boolean;
};

type DressedScene =
  | {
      readonly kind: 'plain';
      readonly scene: Object3D;
      readonly pose: PlanetPose;
      readonly fit: PlanetPreviewFit;
    }
  | {
      readonly kind: 'effects';
      readonly scene: Object3D;
      readonly materials: ReadonlyArray<MeshStandardMaterial>;
      readonly pulse: PulseSpec;
      readonly pose: PlanetPose;
      readonly fit: PlanetPreviewFit;
    };

const idEncoder = new TextEncoder();
const TWO_PI = Math.PI * 2;
const phaseFromAsset = (assetId: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(assetId)) hash = (hash * 31 + byte) % 1000;
  return (hash / 1000) * TWO_PI;
};

const useDressedScene = (assetId: PlanetAssetId): DressedScene => {
  const { scene } = useGLTF(assetUrl(PLANET_PATHS[assetId]));
  const colorsheet = useTexture(assetUrl(COLORSHEET_PATH));
  return useMemo(() => {
    configureColorsheet(colorsheet);
    const look = resolvePlanetLook(assetId);
    const dressed = cloneAndDress(scene, colorsheet, look);
    const pose = planetPoseFor(dressed.extraction);
    const fit = computePlanetPreviewFit(dressed.scene, pose.alignQuaternion);
    if (look.kind === 'plain') {
      return { kind: 'plain', scene: dressed.scene, pose, fit };
    }
    return {
      kind: 'effects',
      scene: dressed.scene,
      materials: dressed.standardMaterials,
      pulse: look.pulse,
      pose,
      fit,
    };
  }, [scene, colorsheet, assetId]);
};

const useRotatingFrame = (
  groupRef: RefObject<Group | null>,
  dressed: DressedScene,
  phase: number,
): void => {
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y += ROTATION_RATE_RAD_PER_SEC * delta;
    if (dressed.kind === 'effects') {
      animatePulse(dressed.materials, dressed.pulse, state.clock.elapsedTime, phase);
    }
  });
};

const RotatingPlanetScene = (props: PlanetCanvasProps): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const dressed = useDressedScene(props.assetId);
  const phase = useMemo(() => phaseFromAsset(props.assetId), [props.assetId]);
  useRotatingFrame(groupRef, dressed, phase);
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={2.0} color={KEY_COLOR} />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} color={FILL_COLOR} />
      <group scale={1.4}>
        <group scale={dressed.fit.uniformScale}>
          <group position={dressed.fit.translation}>
            <group ref={groupRef}>
              <group quaternion={dressed.pose.alignQuaternion}>
                <primitive object={dressed.scene} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </>
  );
};

const StaticPlanetScene = (props: PlanetCanvasProps): JSX.Element => {
  const dressed = useDressedScene(props.assetId);
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={2.0} color={KEY_COLOR} />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} color={FILL_COLOR} />
      <group scale={1.4}>
        <group scale={dressed.fit.uniformScale}>
          <group position={dressed.fit.translation}>
            <group quaternion={dressed.pose.alignQuaternion}>
              <primitive object={dressed.scene} />
            </group>
          </group>
        </group>
      </group>
    </>
  );
};

export const PlanetCanvas = (props: PlanetCanvasProps): JSX.Element => (
  <div
    data-asset={props.assetId}
    data-rotates={String(props.rotates)}
    className="relative h-full w-full overflow-hidden rounded-full"
  >
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 3.6], fov: 28 }}
      frameloop={props.rotates ? 'always' : 'demand'}
    >
      {props.rotates ? <RotatingPlanetScene {...props} /> : <StaticPlanetScene {...props} />}
    </Canvas>
  </div>
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/components/ProgressCard/PlanetCanvas.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/components/ProgressCard/PlanetCanvas.tsx src/features/progress/components/ProgressCard/PlanetCanvas.test.tsx
git commit -m "progress: PlanetCanvas internal helper (rotation parameterized)"
```

---

## Task 9: HeadlinePlanet component

Wraps `PlanetCanvas` at 52px with `rotates=true`. Handles the empty state by rendering a 52px dashed circle (no Canvas, no GLTF load). Receives a `Headline` value; the rendered planet is the headline's `company.assetId` when not empty. Emits no events.

**Files:**
- Create: `src/features/progress/components/ProgressCard/HeadlinePlanet.tsx`
- Create: `src/features/progress/components/ProgressCard/HeadlinePlanet.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/components/ProgressCard/HeadlinePlanet.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { asCompanyId } from '../../../scene/types/company';
import { asShortCode } from '../../types/short-code';
import type { Headline } from '../../types/headline';
import { HeadlinePlanet } from './HeadlinePlanet';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { readonly children?: ReactNode }): JSX.Element => (
    <div data-test-canvas>{children}</div>
  ),
  useFrame: (): void => {},
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: (): unknown => ({}) } }),
  useTexture: () => ({}),
}));

describe('HeadlinePlanet', () => {
  it('renders the empty placeholder when headline kind is empty', () => {
    const headline: Headline = { kind: 'empty' };
    const { container } = render(<HeadlinePlanet headline={headline} />);
    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();
    expect(container.querySelector('[data-test-canvas]')).toBeNull();
  });

  it('renders a PlanetCanvas with the company asset when headline kind is active', () => {
    const headline: Headline = {
      kind: 'active',
      company: {
        id: asCompanyId('riverside'),
        assetId: 'mars_b',
        shortCode: asShortCode('RVS'),
      },
    };
    const { container } = render(<HeadlinePlanet headline={headline} />);
    expect(container.querySelector('[data-state="active"]')).not.toBeNull();
    expect(container.querySelector('[data-asset="mars_b"]')).not.toBeNull();
    expect(container.querySelector('[data-rotates="true"]')).not.toBeNull();
  });

  it('renders with data-state="anchor" for anchor headline', () => {
    const headline: Headline = {
      kind: 'anchor',
      company: {
        id: asCompanyId('mave'),
        assetId: 'saturn_b',
        shortCode: asShortCode('MAV'),
      },
    };
    const { container } = render(<HeadlinePlanet headline={headline} />);
    expect(container.querySelector('[data-state="anchor"]')).not.toBeNull();
  });

  it('renders with data-state="complete" for complete headline', () => {
    const headline: Headline = {
      kind: 'complete',
      company: {
        id: asCompanyId('tgs'),
        assetId: 'venus_b',
        shortCode: asShortCode('TGS'),
      },
    };
    const { container } = render(<HeadlinePlanet headline={headline} />);
    expect(container.querySelector('[data-state="complete"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/components/ProgressCard/HeadlinePlanet.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement HeadlinePlanet.tsx**

Create `src/features/progress/components/ProgressCard/HeadlinePlanet.tsx`:

```typescript
import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { Headline } from '../../types/headline';
import { PlanetCanvas } from './PlanetCanvas';

type HeadlinePlanetProps = {
  readonly headline: Headline;
};

const BASE_CLASSNAME = 'relative flex items-center justify-center';
const SIZE_CLASSNAME = 'h-[52px] w-[52px]';

const EMPTY_CLASSNAME = cn(
  BASE_CLASSNAME,
  SIZE_CLASSNAME,
  'rounded-full border-[1.5px] border-dashed border-foreground/20',
  'bg-[radial-gradient(circle_at_50%_50%,rgba(230,234,242,0.06)_0%,rgba(230,234,242,0.0)_70%)]',
);

const ACTIVE_GLOW_CLASSNAME = cn(
  'shadow-[0_0_0_2px_rgba(95,214,255,0.18),0_0_18px_#5fd6ff,0_0_34px_rgba(95,214,255,0.18)]',
);

const COMPLETE_GLOW_CLASSNAME = cn(
  'shadow-[0_0_0_2px_rgba(123,224,162,0.18),0_0_18px_#7be0a2,0_0_34px_rgba(123,224,162,0.18)]',
);

const glowClassFor = (kind: Headline['kind']): string => {
  switch (kind) {
    case 'empty':
    case 'anchor':
      return '';
    case 'active':
      return ACTIVE_GLOW_CLASSNAME;
    case 'complete':
      return COMPLETE_GLOW_CLASSNAME;
  }
};

export const HeadlinePlanet = (props: HeadlinePlanetProps): JSX.Element => {
  if (props.headline.kind === 'empty') {
    return <div data-state="empty" data-headline className={EMPTY_CLASSNAME} aria-hidden="true" />;
  }
  const { company } = props.headline;
  return (
    <div
      data-state={props.headline.kind}
      data-headline
      className={cn(BASE_CLASSNAME, SIZE_CLASSNAME, 'rounded-full', glowClassFor(props.headline.kind))}
      aria-label={`Planet for ${company.id}`}
    >
      <PlanetCanvas assetId={company.assetId} rotates={true} />
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/components/ProgressCard/HeadlinePlanet.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/components/ProgressCard/HeadlinePlanet.tsx src/features/progress/components/ProgressCard/HeadlinePlanet.test.tsx
git commit -m "progress: HeadlinePlanet component (52px, rotating, empty-state aware)"
```

---

## Task 10: ProgressPip component

Wraps `PlanetCanvas` at 16px with `rotates=false`. Receives a `Pip`, an `isBursting` flag, and a `MotionPreference`. Wrapper carries `data-state`, `data-burst`, and `data-motion` attributes for CSS-driven styling. When `isBursting && motion.kind === 'normal'`, renders three concentric ripple `<span>` elements.

**Files:**
- Create: `src/features/progress/components/ProgressCard/ProgressPip.tsx`
- Create: `src/features/progress/components/ProgressCard/ProgressPip.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/components/ProgressCard/ProgressPip.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { asCompanyId } from '../../../scene/types/company';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import type { Pip } from '../../types/pip';
import { ProgressPip } from './ProgressPip';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { readonly children?: ReactNode }): JSX.Element => (
    <div data-test-canvas>{children}</div>
  ),
  useFrame: (): void => {},
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: (): unknown => ({}) } }),
  useTexture: () => ({}),
}));

const motion = (kind: MotionPreference['kind']): MotionPreference => ({ kind });

const pip = (kind: Pip['kind']): Pip => ({
  kind,
  companyId: asCompanyId('mars'),
  assetId: 'mars_b',
});

describe('ProgressPip', () => {
  it('renders data-state="unvisited" for unvisited pip', () => {
    const { container } = render(
      <ProgressPip pip={pip('unvisited')} isBursting={false} motion={motion('normal')} />,
    );
    expect(container.querySelector('[data-state="unvisited"]')).not.toBeNull();
  });

  it('renders data-state="visited" for visited pip', () => {
    const { container } = render(
      <ProgressPip pip={pip('visited')} isBursting={false} motion={motion('normal')} />,
    );
    expect(container.querySelector('[data-state="visited"]')).not.toBeNull();
  });

  it('renders data-state="here" for here pip', () => {
    const { container } = render(
      <ProgressPip pip={pip('here')} isBursting={false} motion={motion('normal')} />,
    );
    expect(container.querySelector('[data-state="here"]')).not.toBeNull();
  });

  it('renders 3 ripple elements when bursting and motion is normal', () => {
    const { container } = render(
      <ProgressPip pip={pip('here')} isBursting={true} motion={motion('normal')} />,
    );
    expect(container.querySelectorAll('[data-ripple]').length).toBe(3);
  });

  it('renders 0 ripple elements when bursting and motion is reduced', () => {
    const { container } = render(
      <ProgressPip pip={pip('here')} isBursting={true} motion={motion('reduced')} />,
    );
    expect(container.querySelectorAll('[data-ripple]').length).toBe(0);
  });

  it('renders 0 ripple elements when not bursting (even with motion normal)', () => {
    const { container } = render(
      <ProgressPip pip={pip('here')} isBursting={false} motion={motion('normal')} />,
    );
    expect(container.querySelectorAll('[data-ripple]').length).toBe(0);
  });

  it('exposes data-motion attribute reflecting the preference', () => {
    const { container: normalC } = render(
      <ProgressPip pip={pip('visited')} isBursting={false} motion={motion('normal')} />,
    );
    expect(normalC.querySelector('[data-motion="normal"]')).not.toBeNull();

    const { container: reducedC } = render(
      <ProgressPip pip={pip('visited')} isBursting={false} motion={motion('reduced')} />,
    );
    expect(reducedC.querySelector('[data-motion="reduced"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/components/ProgressCard/ProgressPip.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement ProgressPip.tsx**

Create `src/features/progress/components/ProgressCard/ProgressPip.tsx`:

```typescript
import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import type { Pip } from '../../types/pip';
import { PlanetCanvas } from './PlanetCanvas';

type ProgressPipProps = {
  readonly pip: Pip;
  readonly isBursting: boolean;
  readonly motion: MotionPreference;
};

const SIZE_CLASSNAME = 'h-4 w-4'; // 16px

const STATE_CLASSNAME: Readonly<Record<Pip['kind'], string>> = {
  unvisited: 'grayscale brightness-[0.45] contrast-[0.85] opacity-40',
  visited: '',
  here: cn(
    'shadow-[0_0_0_1.5px_rgba(95,214,255,0.18),0_0_8px_#5fd6ff,0_0_16px_rgba(95,214,255,0.18)]',
  ),
};

const renderRipples = (): JSX.Element => (
  <>
    <span
      data-ripple="small"
      aria-hidden="true"
      className="absolute -inset-[3px] rounded-full border-[1.5px] border-(--color-accent) opacity-60"
    />
    <span
      data-ripple="big"
      aria-hidden="true"
      className="absolute -inset-3 rounded-full border border-(--color-accent) opacity-35"
    />
    <span
      data-ripple="huge"
      aria-hidden="true"
      className="absolute -inset-[22px] rounded-full border border-(--color-accent) opacity-20"
    />
  </>
);

export const ProgressPip = (props: ProgressPipProps): JSX.Element => {
  const showRipples = props.isBursting && props.motion.kind === 'normal';
  return (
    <div
      data-pip
      data-state={props.pip.kind}
      data-burst={props.isBursting ? 'active' : 'idle'}
      data-motion={props.motion.kind}
      data-company={props.pip.companyId}
      className={cn(
        'relative rounded-full',
        SIZE_CLASSNAME,
        STATE_CLASSNAME[props.pip.kind],
        'transition-[filter,opacity,box-shadow,transform] duration-300 ease-out',
        'data-[motion=reduced]:transition-none',
      )}
    >
      <PlanetCanvas assetId={props.pip.assetId} rotates={false} />
      {showRipples ? renderRipples() : null}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/components/ProgressCard/ProgressPip.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/components/ProgressCard/ProgressPip.tsx src/features/progress/components/ProgressCard/ProgressPip.test.tsx
git commit -m "progress: ProgressPip component (16px, state-driven, ripple-on-burst)"
```

---

## Task 11: ProgressCard composition

The main card component. Composes the chrome shell + HeadlinePlanet + short-code text + StatusLabel + ProgressCounter + 5 ProgressPips. Receives `projection`, `visitEvent`, `motion`, `visibility`. Returns `null` when visibility is hidden. Carries `data-state` reflecting overall card mode (`pre_route | mid_route | complete`) and `data-burst` when a visit event is active. The card's outer `data-burst` is what drives the card-border swell keyframe.

**Files:**
- Create: `src/features/progress/components/ProgressCard/ProgressCard.tsx`
- Create: `src/features/progress/components/ProgressCard/ProgressCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/components/ProgressCard/ProgressCard.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { asCompanyId } from '../../../scene/types/company';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import { asShortCode } from '../../types/short-code';
import type { ProgressProjection } from '../../types/progress-projection';
import type { ProgressVisibility } from '../../types/progress-visibility';
import type { VisitEvent } from '../../types/visit-event';
import { ProgressCard } from './ProgressCard';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { readonly children?: ReactNode }): JSX.Element => (
    <div data-test-canvas>{children}</div>
  ),
  useFrame: (): void => {},
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: (): unknown => ({}) } }),
  useTexture: () => ({}),
}));

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

const motion = (kind: MotionPreference['kind']): MotionPreference => ({ kind });
const visible: ProgressVisibility = { kind: 'visible' };
const hidden: ProgressVisibility = { kind: 'hidden' };

const preRouteProjection: ProgressProjection = {
  headline: { kind: 'empty' },
  status: { kind: 'standby' },
  counter: { kind: 'idle', visited: 0, total: 5 },
  pips: [
    { kind: 'unvisited', companyId: mave, assetId: 'saturn_b' },
    { kind: 'unvisited', companyId: eightfig, assetId: 'jupiter_b' },
    { kind: 'unvisited', companyId: riverside, assetId: 'mars_b' },
    { kind: 'unvisited', companyId: streamelements, assetId: 'earth_b' },
    { kind: 'unvisited', companyId: tgs, assetId: 'venus_b' },
  ],
};

const midRouteProjection: ProgressProjection = {
  headline: {
    kind: 'active',
    company: { id: riverside, assetId: 'mars_b', shortCode: asShortCode('RVS') },
  },
  status: { kind: 'active' },
  counter: { kind: 'idle', visited: 3, total: 5 },
  pips: [
    { kind: 'visited', companyId: mave, assetId: 'saturn_b' },
    { kind: 'visited', companyId: eightfig, assetId: 'jupiter_b' },
    { kind: 'here', companyId: riverside, assetId: 'mars_b' },
    { kind: 'unvisited', companyId: streamelements, assetId: 'earth_b' },
    { kind: 'unvisited', companyId: tgs, assetId: 'venus_b' },
  ],
};

describe('ProgressCard', () => {
  it('returns null when visibility is hidden', () => {
    const { container } = render(
      <ProgressCard
        projection={preRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={hidden}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the card when visibility is visible', () => {
    const { container } = render(
      <ProgressCard
        projection={preRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    expect(container.querySelector('[data-progress-card]')).not.toBeNull();
  });

  it('renders 5 pip elements in canonical career order (companyIds)', () => {
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const pips = container.querySelectorAll('[data-pip]');
    expect(pips.length).toBe(5);
    expect(pips[0].getAttribute('data-company')).toBe(mave);
    expect(pips[1].getAttribute('data-company')).toBe(eightfig);
    expect(pips[2].getAttribute('data-company')).toBe(riverside);
    expect(pips[3].getAttribute('data-company')).toBe(streamelements);
    expect(pips[4].getAttribute('data-company')).toBe(tgs);
  });

  it('renders the headline short code text when headline is not empty', () => {
    render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    expect(screen.getByText('RVS')).toBeTruthy();
  });

  it('renders em-dash when headline is empty', () => {
    render(
      <ProgressCard
        projection={preRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('applies data-burst="active" to the card when a first_visit event is present', () => {
    const visitEvent: VisitEvent = {
      kind: 'first_visit',
      companyId: riverside,
      assetId: 'mars_b',
    };
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={visitEvent}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const card = container.querySelector('[data-progress-card]');
    expect(card?.getAttribute('data-burst')).toBe('active');
  });

  it('applies data-burst="active" to the card when a route_complete event is present', () => {
    const visitEvent: VisitEvent = {
      kind: 'route_complete',
      companyId: tgs,
      assetId: 'venus_b',
    };
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={visitEvent}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const card = container.querySelector('[data-progress-card]');
    expect(card?.getAttribute('data-burst')).toBe('active');
  });

  it('applies isBursting only to the matching pip, not the others', () => {
    const visitEvent: VisitEvent = {
      kind: 'first_visit',
      companyId: riverside,
      assetId: 'mars_b',
    };
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={visitEvent}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const matchedPip = container.querySelector(`[data-pip][data-company="${riverside}"]`);
    expect(matchedPip?.getAttribute('data-burst')).toBe('active');

    const otherPip = container.querySelector(`[data-pip][data-company="${mave}"]`);
    expect(otherPip?.getAttribute('data-burst')).toBe('idle');
  });

  it('does NOT apply isBursting to any pip on a revisit event (revisits do not ripple)', () => {
    const visitEvent: VisitEvent = {
      kind: 'revisit',
      companyId: mave,
      assetId: 'saturn_b',
    };
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={visitEvent}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const allPips = container.querySelectorAll('[data-pip]');
    for (const pip of allPips) {
      expect(pip.getAttribute('data-burst')).toBe('idle');
    }
  });

  it('exposes aria-label on the card root', () => {
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const card = container.querySelector('[data-progress-card]');
    expect(card?.getAttribute('aria-label')).toBe('Exploration progress');
  });

  it('exposes data-state="complete" when counter is complete', () => {
    const completeProjection: ProgressProjection = {
      ...midRouteProjection,
      headline: {
        kind: 'complete',
        company: { id: tgs, assetId: 'venus_b', shortCode: asShortCode('TGS') },
      },
      status: { kind: 'route_complete' },
      counter: { kind: 'complete', total: 5 },
      pips: [
        { kind: 'visited', companyId: mave, assetId: 'saturn_b' },
        { kind: 'visited', companyId: eightfig, assetId: 'jupiter_b' },
        { kind: 'visited', companyId: riverside, assetId: 'mars_b' },
        { kind: 'visited', companyId: streamelements, assetId: 'earth_b' },
        { kind: 'visited', companyId: tgs, assetId: 'venus_b' },
      ],
    };
    const { container } = render(
      <ProgressCard
        projection={completeProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const card = container.querySelector('[data-progress-card]');
    expect(card?.getAttribute('data-state')).toBe('complete');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/components/ProgressCard/ProgressCard.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement ProgressCard.tsx**

Create `src/features/progress/components/ProgressCard/ProgressCard.tsx`:

```typescript
import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import type { Counter } from '../../types/counter';
import type { Headline } from '../../types/headline';
import type { Pip } from '../../types/pip';
import type { ProgressProjection } from '../../types/progress-projection';
import type { ProgressVisibility } from '../../types/progress-visibility';
import type { VisitEvent } from '../../types/visit-event';
import { HeadlinePlanet } from './HeadlinePlanet';
import { ProgressCounter } from './ProgressCounter';
import { ProgressPip } from './ProgressPip';
import { StatusLabel } from './StatusLabel';

type ProgressCardProps = {
  readonly projection: ProgressProjection;
  readonly visitEvent: VisitEvent | null;
  readonly motion: MotionPreference;
  readonly visibility: ProgressVisibility;
};

const cardModeFor = (counter: Counter): 'pre_route' | 'mid_route' | 'complete' => {
  if (counter.kind === 'complete') return 'complete';
  return counter.visited === 0 ? 'pre_route' : 'mid_route';
};

const isVisitBurst = (event: VisitEvent): boolean =>
  event.kind === 'first_visit' || event.kind === 'route_complete';

const isCardBursting = (event: VisitEvent | null): boolean =>
  event !== null && isVisitBurst(event);

const pipBursting = (pip: Pip, event: VisitEvent | null): boolean => {
  if (event === null) return false;
  if (!isVisitBurst(event)) return false;
  return pip.companyId === event.companyId;
};

const headlineShortCodeText = (headline: Headline): string =>
  headline.kind === 'empty' ? '—' : headline.company.shortCode;

const CARD_CLASSNAME = cn(
  'pointer-events-none fixed left-6 top-1/2 z-40 -translate-y-1/2',
  'flex w-[84px] flex-col items-stretch gap-2',
  'rounded-xl bg-card/85 px-[0.6rem] py-[0.85rem] pb-[0.7rem]',
  'ring-1 ring-foreground/10 shadow-2xl backdrop-blur-md',
  'border border-foreground/10',
  'transition-[border-color,box-shadow] duration-[800ms] ease-out',
  // Burst-state — these classes layer onto the base; CSS in globals.css
  // animates from rest → peak → rest as data-burst flips.
  'data-[burst=active]:border-(--color-accent)',
  'data-[burst=active]:shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_0_1.5px_rgba(95,214,255,0.18),0_0_22px_rgba(95,214,255,0.24),0_0_60px_rgba(95,214,255,0.10)]',
  // Complete-state breathing border — animation defined in globals.css
  'data-[state=complete]:animate-[progress-card-breathe_6s_ease-in-out_infinite]',
  'data-[state=complete]:border-[rgba(123,224,162,0.22)]',
  'motion-reduce:transition-none',
  'data-[motion=reduced]:transition-none',
  'data-[motion=reduced]:animate-none',
);

const SHORT_CODE_CLASSNAME = cn(
  'font-mono text-[13px] font-semibold leading-tight tracking-[0.14em]',
  'text-center text-foreground',
);

const SHORT_CODE_EMPTY_CLASSNAME = cn(SHORT_CODE_CLASSNAME, 'text-foreground/22 font-medium');

const RULE_CLASSNAME = cn(
  'h-px w-full',
  'bg-[linear-gradient(90deg,transparent_0%,rgba(230,234,242,0.10)_25%,rgba(230,234,242,0.10)_75%,transparent_100%)]',
);

export const ProgressCard = (props: ProgressCardProps): JSX.Element | null => {
  if (props.visibility.kind === 'hidden') return null;

  const cardMode = cardModeFor(props.projection.counter);
  const bursting = isCardBursting(props.visitEvent);
  const visitedCount =
    props.projection.counter.kind === 'idle'
      ? props.projection.counter.visited
      : props.projection.counter.total;
  const headlineCode = headlineShortCodeText(props.projection.headline);

  return (
    <section
      data-progress-card
      data-state={cardMode}
      data-burst={bursting ? 'active' : 'idle'}
      data-motion={props.motion.kind}
      aria-label="Exploration progress"
      className={CARD_CLASSNAME}
    >
      <div className="flex items-center justify-center pt-[2px]">
        <HeadlinePlanet headline={props.projection.headline} />
      </div>

      <div className="flex flex-col items-center gap-[2px] text-center">
        <span
          data-headline-code
          className={
            props.projection.headline.kind === 'empty'
              ? SHORT_CODE_EMPTY_CLASSNAME
              : SHORT_CODE_CLASSNAME
          }
        >
          {headlineCode}
        </span>
        <StatusLabel value={props.projection.status} />
      </div>

      <span aria-hidden="true" className={RULE_CLASSNAME} />

      <ProgressCounter value={props.projection.counter} flipKey={visitedCount} />

      <span aria-hidden="true" className={RULE_CLASSNAME} />

      <div className="flex flex-col items-center gap-2 pt-[2px]">
        {props.projection.pips.map((pip) => (
          <ProgressPip
            key={pip.companyId}
            pip={pip}
            isBursting={pipBursting(pip, props.visitEvent)}
            motion={props.motion}
          />
        ))}
      </div>
    </section>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/components/ProgressCard/ProgressCard.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/components/ProgressCard/ProgressCard.tsx src/features/progress/components/ProgressCard/ProgressCard.test.tsx
git commit -m "progress: ProgressCard composition (chrome + pips + headline + counter)"
```

---

## Task 12: useProgress hook

The composition root for the feature. Subscribes to `subscribePrefersReducedMotion`, holds a `prevProjection` ref, computes `next = projectProgress(...)` on each render, runs `detectVisitEvents(prev, next)`, and exposes the visit event in state for a fixed window (1100ms for regular visits, 1500ms for completing visits, 600ms for revisits and departs). The event is cleared by a `setTimeout` after the window — this is the only `useEffect` in the feature.

**Files:**
- Create: `src/features/progress/widget/card/useProgress.ts`
- Create: `src/features/progress/widget/card/useProgress.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/progress/widget/card/useProgress.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asCompanyId, type CompanyEntry } from '../../../scene/types/company';
import type { PlanetAssetId } from '../../../scene/types/planet';
import type { SceneState } from '../../../scene/types/scene-state';
import { useProgress } from './useProgress';

vi.mock('../../../comms/services/prefersReducedMotion', () => ({
  subscribePrefersReducedMotion: (cb: (p: { kind: 'normal' | 'reduced' }) => void) => {
    cb({ kind: 'normal' });
    return (): void => {};
  },
}));

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

const placement = (z: number): readonly [number, number, number] => [0, 0, z];

const entryFor = (
  id: CompanyEntry['id'],
  assetId: PlanetAssetId,
  z: number,
): CompanyEntry => ({
  id,
  planet: { assetId, placement: placement(z) },
  info: {
    companyName: 'X',
    logo: { kind: 'no_icon' },
    website: { kind: 'no_website' },
    role: 'X',
    period: { kind: 'ongoing', start: { year: 2020, month: 1 } },
    oneLiner: 'X',
    hook: 'X',
    decision: { kind: 'none' },
    work: ['X'],
    departure: { kind: 'current_role' },
  },
});

const ROUTE: readonly [
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
] = [
  entryFor(mave, 'saturn_b', 70),
  entryFor(eightfig, 'jupiter_b', 170),
  entryFor(riverside, 'mars_b', 250),
  entryFor(streamelements, 'earth_b', 325),
  entryFor(tgs, 'venus_b', 395),
];

describe('useProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a well-formed projection on first render', () => {
    const state: SceneState = { kind: 'playing' };
    const { result } = renderHook(() => useProgress({ state, visited: [], route: ROUTE }));
    expect(result.current.projection.headline.kind).toBe('empty');
    expect(result.current.projection.counter).toEqual({ kind: 'idle', visited: 0, total: 5 });
    expect(result.current.visitEvent).toBeNull();
  });

  it('exposes a visit event after a transition to revealing a new planet', () => {
    const { rerender, result } = renderHook(
      (props: { state: SceneState; visited: ReadonlyArray<string> }) =>
        useProgress({
          state: props.state,
          visited: props.visited as ReadonlyArray<typeof mave>,
          route: ROUTE,
        }),
      { initialProps: { state: { kind: 'playing' } as SceneState, visited: [] } },
    );

    rerender({
      state: { kind: 'revealing', objectId: mave } as SceneState,
      visited: [],
    });

    expect(result.current.visitEvent).toEqual({
      kind: 'first_visit',
      companyId: mave,
      assetId: 'saturn_b',
    });
  });

  it('clears the visit event after the regular-visit window elapses', () => {
    const { rerender, result } = renderHook(
      (props: { state: SceneState; visited: ReadonlyArray<typeof mave> }) =>
        useProgress({ state: props.state, visited: props.visited, route: ROUTE }),
      { initialProps: { state: { kind: 'playing' } as SceneState, visited: [] } },
    );

    rerender({
      state: { kind: 'revealing', objectId: mave } as SceneState,
      visited: [],
    });
    expect(result.current.visitEvent).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.visitEvent).toBeNull();
  });

  it('clears the visit event after the route-complete window (1500ms)', () => {
    const { rerender, result } = renderHook(
      (props: { state: SceneState; visited: ReadonlyArray<typeof mave> }) =>
        useProgress({ state: props.state, visited: props.visited, route: ROUTE }),
      {
        initialProps: {
          state: { kind: 'revealing', objectId: streamelements } as SceneState,
          visited: [mave, eightfig, riverside],
        },
      },
    );

    rerender({
      state: { kind: 'revealing', objectId: tgs } as SceneState,
      visited: [mave, eightfig, riverside, streamelements],
    });
    expect(result.current.visitEvent?.kind).toBe('route_complete');

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.visitEvent).not.toBeNull(); // not cleared at 1200ms yet

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.visitEvent).toBeNull();
  });

  it('exposes visibility based on scene state', () => {
    const { result, rerender } = renderHook(
      (props: { state: SceneState }) =>
        useProgress({ state: props.state, visited: [], route: ROUTE }),
      { initialProps: { state: { kind: 'loading' } as SceneState } },
    );
    expect(result.current.visibility).toEqual({ kind: 'hidden' });

    rerender({ state: { kind: 'playing' } as SceneState });
    expect(result.current.visibility).toEqual({ kind: 'visible' });
  });

  it('exposes motion preference', () => {
    const { result } = renderHook(() =>
      useProgress({ state: { kind: 'playing' } as SceneState, visited: [], route: ROUTE }),
    );
    expect(result.current.motion).toEqual({ kind: 'normal' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/progress/widget/card/useProgress.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement useProgress.ts**

Create `src/features/progress/widget/card/useProgress.ts`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompanyEntry, CompanyId } from '../../../scene/types/company';
import type { SceneState } from '../../../scene/types/scene-state';
import { subscribePrefersReducedMotion } from '../../../comms/services/prefersReducedMotion';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import type { ProgressProjection } from '../../types/progress-projection';
import type { ProgressVisibility } from '../../types/progress-visibility';
import type { VisitEvent } from '../../types/visit-event';
import { detectVisitEvents } from './detectVisitEvents';
import { projectProgress } from './projectProgress';
import { projectVisibility } from './projectVisibility';

type Route = readonly [CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry];

type UseProgressInput = {
  readonly state: SceneState;
  readonly visited: ReadonlyArray<CompanyId>;
  readonly route: Route;
};

export type UseProgressResult = {
  readonly projection: ProgressProjection;
  readonly visitEvent: VisitEvent | null;
  readonly motion: MotionPreference;
  readonly visibility: ProgressVisibility;
};

const REGULAR_WINDOW_MS = 1100;
const COMPLETE_WINDOW_MS = 1500;
const REVISIT_WINDOW_MS = 600;

const windowFor = (event: VisitEvent): number => {
  switch (event.kind) {
    case 'first_visit':
      return REGULAR_WINDOW_MS;
    case 'route_complete':
      return COMPLETE_WINDOW_MS;
    case 'revisit':
    case 'depart':
      return REVISIT_WINDOW_MS;
  }
};

export const useProgress = (input: UseProgressInput): UseProgressResult => {
  const projection = useMemo(
    () => projectProgress(input.state, input.visited, input.route),
    [input.state, input.visited, input.route],
  );

  const prevProjectionRef = useRef<ProgressProjection>(projection);
  const [visitEvent, setVisitEvent] = useState<VisitEvent | null>(null);
  const [motion, setMotion] = useState<MotionPreference>({ kind: 'normal' });

  // Visit-event detection happens during the commit phase of every render
  // where the projection changed. The reference equality of `projection`
  // (via useMemo above) means we only run this when projectProgress's inputs
  // actually changed. The timer is scoped to the event window; on each new
  // event the previous timer is cleared.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevProjectionRef.current;
    if (prev === projection) return;
    const event = detectVisitEvents(prev, projection);
    prevProjectionRef.current = projection;
    if (event === null) return;

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setVisitEvent(event);
    const ms = windowFor(event);
    timerRef.current = setTimeout(() => {
      setVisitEvent(null);
      timerRef.current = null;
    }, ms);
  }, [projection]);

  useEffect(() => {
    const unsubscribe = subscribePrefersReducedMotion((pref) => setMotion(pref));
    return unsubscribe;
  }, []);

  useEffect(
    () => (): void => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const visibility = useMemo(() => projectVisibility(input.state), [input.state]);

  return { projection, visitEvent, motion, visibility };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/progress/widget/card/useProgress.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/widget/card/useProgress.ts src/features/progress/widget/card/useProgress.test.ts
git commit -m "progress: useProgress widget hook (projection + visit-event window + motion subscription)"
```

---

## Task 13: ProgressCardWidget shell

Thin composition root. Receives `state` + `visited`, calls `useProgress`, hands the result to `ProgressCard`. No logic. No tests — the underlying pieces are already fully tested; this widget just wires them.

**Files:**
- Create: `src/features/progress/widget/card/ProgressCardWidget.tsx`

- [ ] **Step 1: Implement ProgressCardWidget.tsx**

Create `src/features/progress/widget/card/ProgressCardWidget.tsx`:

```typescript
import type { JSX } from 'react';
import type { CompanyEntry, CompanyId } from '../../../scene/types/company';
import type { SceneState } from '../../../scene/types/scene-state';
import { ProgressCard } from '../../components/ProgressCard/ProgressCard';
import { useProgress } from './useProgress';

type Route = readonly [CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry];

type ProgressCardWidgetProps = {
  readonly state: SceneState;
  readonly visited: ReadonlyArray<CompanyId>;
  readonly route: Route;
};

export const ProgressCardWidget = (props: ProgressCardWidgetProps): JSX.Element => {
  const { projection, visitEvent, motion, visibility } = useProgress({
    state: props.state,
    visited: props.visited,
    route: props.route,
  });
  return (
    <ProgressCard
      projection={projection}
      visitEvent={visitEvent}
      motion={motion}
      visibility={visibility}
    />
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/progress/widget/card/ProgressCardWidget.tsx
git commit -m "progress: ProgressCardWidget shell"
```

---

## Task 14: Expose visited from useScene

Currently `useScene` consumes `visited` internally for `projectRoute` and does not return it. Add `visited` to the return type so `SceneWidget` can pass it to `ProgressCardWidget`.

**Files:**
- Modify: `src/features/scene/widget/scene/useScene.ts`

- [ ] **Step 1: Read the current file**

Read `src/features/scene/widget/scene/useScene.ts` and confirm the current `UseSceneResult` type does not include `visited`.

- [ ] **Step 2: Add `visited` to the return type**

In `src/features/scene/widget/scene/useScene.ts`, locate the `UseSceneResult` type (currently includes `state`, `entries`, `fillerPlanets`, etc.) and add:

```typescript
type UseSceneResult = {
  readonly state: SceneState;
  readonly visited: ReadonlyArray<CompanyId>;
  readonly entries: ReadonlyArray<CompanyEntry>;
  // ... existing fields unchanged
};
```

Add the `CompanyId` import at the top if not already present (it's imported via `CompanyEntry` indirectly, but the explicit re-import is clearer):

```typescript
import type { CompanyEntry, CompanyId } from '../../types/company';
```

In the `useScene` function, find the line `const visited = getVisited(snapshot);` and ensure it's already there (it is — used by `projectRoute`). Add `visited` to the return object:

```typescript
return {
  state,
  visited,
  entries,
  // ... existing return fields unchanged
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Run the scene tests to confirm nothing broke**

Run: `pnpm test src/features/scene/`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/widget/scene/useScene.ts
git commit -m "scene: expose visited from useScene for progress widget consumption"
```

---

## Task 15: Mount ProgressCardWidget in SceneWidget

Add the new widget alongside the existing `CommsDockWidget` and `AudioControlsWidget`. It receives `state`, `visited`, and `CAREER_ROUTE`.

**Files:**
- Modify: `src/features/scene/widget/scene/SceneWidget.tsx`

- [ ] **Step 1: Open the current SceneWidget**

Read `src/features/scene/widget/scene/SceneWidget.tsx`. Confirm the current structure mounts `<CommsDockWidget />` and `<AudioControlsWidget />`.

- [ ] **Step 2: Add the import**

At the top of `SceneWidget.tsx`, add:

```typescript
import { ProgressCardWidget } from '../../../progress/widget/card/ProgressCardWidget';
import { CAREER_ROUTE } from './companies';
```

- [ ] **Step 3: Destructure `visited` from `useScene()`**

Update the destructuring:

```typescript
const {
  state,
  visited,
  entries,
  fillerPlanets,
  intents,
  onEvent,
  revealProjection,
  routeProjection,
  kinematicsRef,
  audio,
} = useScene();
```

- [ ] **Step 4: Mount the widget**

Inside the return JSX, alongside `<CommsDockWidget …/>` and `<AudioControlsWidget />`, add:

```typescript
<ProgressCardWidget state={state} visited={visited} route={CAREER_ROUTE} />
```

The order does not matter visually (each widget uses `position: fixed`), but conventionally place it after `<CommsDockWidget>` and before `<AudioControlsWidget>` for readability.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: exits 0, no errors.

- [ ] **Step 6: Run all tests**

Run: `pnpm test`
Expected: PASS, all tests including the new progress feature ones.

- [ ] **Step 7: Commit**

```bash
git add src/features/scene/widget/scene/SceneWidget.tsx
git commit -m "scene: mount ProgressCardWidget alongside dock and audio controls"
```

---

## Task 16: CSS keyframes — ripple, border-swell, breathe, counter-flip-glow

The components use `data-*` attributes for state. The CSS that animates these is global. Add keyframes and attribute-selector rules to `src/styles/globals.css`, following the existing pattern used for `panel-section-in`.

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Open globals.css**

Read `src/styles/globals.css`. Confirm the existing `@keyframes panel-section-in` block at the bottom of the file is intact.

- [ ] **Step 2: Append progress-feature keyframes and selectors**

At the bottom of `src/styles/globals.css`, append:

```css
/* ============================================================
 * Progress card — animations
 *
 * The progress card surfaces visit moments with three layered
 * effects driven by data-* attributes:
 *   data-burst="active" on the card → border swell
 *   data-burst="active" on a pip    → 3 concentric ripples
 *   data-flipping on counter visited → brief text-shadow glow
 *   data-state="complete" on the card → persistent breathing border
 * ============================================================ */

@keyframes progress-pip-ripple-small {
  from { opacity: 0.6; transform: scale(1); }
  to   { opacity: 0;   transform: scale(2.2); }
}
@keyframes progress-pip-ripple-big {
  from { opacity: 0.35; transform: scale(1); }
  to   { opacity: 0;    transform: scale(2.6); }
}
@keyframes progress-pip-ripple-huge {
  from { opacity: 0.2; transform: scale(1); }
  to   { opacity: 0;   transform: scale(2.8); }
}

[data-progress-card] [data-pip][data-burst='active'] [data-ripple='small'] {
  animation: progress-pip-ripple-small 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 0ms;
}
[data-progress-card] [data-pip][data-burst='active'] [data-ripple='big'] {
  animation: progress-pip-ripple-big 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 100ms;
}
[data-progress-card] [data-pip][data-burst='active'] [data-ripple='huge'] {
  animation: progress-pip-ripple-huge 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 200ms;
}

/* Pip scale pump during burst — peaks at 1.18 around t=300ms and returns. */
@keyframes progress-pip-peak {
  0%   { transform: scale(1.0); }
  35%  { transform: scale(1.18); }
  100% { transform: scale(1.0); }
}
[data-progress-card] [data-pip][data-burst='active'] {
  animation: progress-pip-peak 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* Counter flip glow — when [data-flipping] value changes, a fresh animation
   instance is created via the attribute-change-driven animation key. */
@keyframes progress-counter-flip-glow {
  0%   { text-shadow: none; }
  20%  { text-shadow: 0 0 8px var(--color-accent); }
  100% { text-shadow: none; }
}
[data-progress-card] [data-count='visited'] {
  animation: progress-counter-flip-glow 200ms ease-out;
  animation-fill-mode: both;
}
[data-progress-card][data-state='complete'] [data-count='visited'],
[data-progress-card][data-state='complete'] [data-count='total'] {
  text-shadow: none;
}

/* Persistent breathing border on completion. */
@keyframes progress-card-breathe {
  0%, 100% {
    border-color: rgba(123, 224, 162, 0.18);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.45),
      0 0 14px rgba(123, 224, 162, 0.06);
  }
  50% {
    border-color: rgba(123, 224, 162, 0.45);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.45),
      0 0 22px rgba(123, 224, 162, 0.14);
  }
}

/* Reduced motion: turn off everything. The state changes (color, count,
 * data-state) still apply — we only strip the transitions and keyframes. */
@media (prefers-reduced-motion: reduce) {
  [data-progress-card] [data-pip][data-burst='active'],
  [data-progress-card] [data-pip][data-burst='active'] [data-ripple],
  [data-progress-card] [data-count='visited'],
  [data-progress-card][data-state='complete'] {
    animation: none !important;
  }
}
[data-progress-card][data-motion='reduced'] [data-pip][data-burst='active'],
[data-progress-card][data-motion='reduced'] [data-pip][data-burst='active'] [data-ripple],
[data-progress-card][data-motion='reduced'] [data-count='visited'],
[data-progress-card][data-motion='reduced'][data-state='complete'] {
  animation: none !important;
}
```

- [ ] **Step 3: Verify the dev server still builds**

Run: `pnpm dev` in a separate terminal. Confirm Vite builds without CSS errors.
Stop the dev server after verification.

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "progress: CSS keyframes (ripples, pip pump, counter flip glow, breathing border)"
```

---

## Task 17: Manual browser smoke test

Final verification. The unit tests cover behavioral correctness; this task confirms the visual outcome matches the spec's storyboards.

**Files:** none (manual)

- [ ] **Step 1: Run pnpm check**

Run: `pnpm check`
Expected: exits 0 — typecheck, lint, suppressor scan, and full test suite all pass.

- [ ] **Step 2: Launch the dev server**

Run: `pnpm dev`
Open the URL printed in the terminal (typically `http://localhost:5173`).

- [ ] **Step 3: Verify initial state (pre-route)**

Pick a ship in the ship selector. Enter the scene.

Expected at scene start:
- A slim card appears on the left edge, vertically centered.
- The headline area shows a dashed circle (empty silhouette).
- The headline text shows `—`.
- The status reads `STANDBY` in dim foreground/22.
- The counter reads `00 / 05`.
- The pip column shows 5 dim, grayscaled planet thumbnails.
- The card border is at the base rest color (subtle hairline).

- [ ] **Step 4: Verify first-visit choreography**

Fly the ship toward one of the company planets (e.g., the closest one) until proximity triggers.

Expected on first proximity entry:
- Card border swells cyan (rise 0–300ms, peak ~300ms, fall back over ~800ms).
- The matching pip in the column scales up briefly, then back.
- Three concentric ripple rings emit outward from that pip.
- The counter visited number rolls from `00` → `01` with a brief text-shadow glow.
- The headline area cross-fades from the empty silhouette to the planet, with the rotating GLTF render.
- The headline text shows the company's short code (e.g., `MAV`, `RVS`).
- The status reads `ACTIVE`.

- [ ] **Step 5: Verify exit-proximity transition**

Fly away from the planet until proximity exits.

Expected:
- Status flips from `ACTIVE` to `LAST EXPLORED`.
- The pip's `here` glow ring is removed; the pip is now in `visited` state.
- The headline shows the same planet (no cross-fade since anchor = active when departing).
- No counter change, no ripples, no border swell.

- [ ] **Step 6: Verify out-of-order visits**

Skip the next-canonical planet and fly directly to a further one.

Expected:
- The card's pip column shows the visited planets lit in their canonical positions (NOT reordered by visit).
- The counter increments correctly.
- The headline updates to the just-visited planet.

- [ ] **Step 7: Verify route-complete moment**

Visit all 5 planets. On the 5th first-visit:

Expected:
- The cyan beat plays first (Scene A choreography).
- ~600ms after the visit, the card color shifts from cyan to green across:
  - Headline halo
  - Pip column glows
  - Counter numbers (both visited and total)
  - Status text → `ROUTE COMPLETE` (rendered with the type-on letters — implemented in this version as an instant swap; type-on is a future polish if desired)
  - Card border
- The card border begins a persistent slow green breathing pulse (~6s loop).

- [ ] **Step 8: Verify reduced-motion mode**

Open the browser dev tools, find the "Rendering" panel (Cmd+Shift+P → "Show Rendering"). Set `prefers-reduced-motion` to `reduce`.

Repeat steps 4–7. Expected: all state changes still happen (counter ticks, planet swaps, color shifts), but with no ripples, no scale pumps, no border swell, no breathing pulse.

- [ ] **Step 9: Verify pause behavior**

Press the pause key (whichever the scene maps it to — typically `P` or `Esc`; consult `useKeyboardIntents`). The card should remain visible (visibility is `visible` during paused). Resume; behavior continues.

- [ ] **Step 10: Verify loading-state invisibility**

Refresh the page. During the very brief `loading` state (before the scene starts), the card should not be visible. As soon as the scene transitions to `playing`, the card appears.

- [ ] **Step 11: Smoke-test final pnpm check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 12: Final commit (if any cleanups were made)**

If any small CSS tweaks were applied during manual testing, commit them:

```bash
git add -A
git status   # confirm only intended files
git commit -m "progress: final polish from manual smoke test"
```

If no changes were made, no commit is needed.

---

## Plan summary

**17 tasks**, ~5 minutes per step, ~6–8 steps per task. Estimated 4–6 hours of focused work.

Coverage:
- Task 1 — domain types (8 files)
- Task 2 — short codes lookup
- Task 3 — visibility projection
- Task 4 — main projection function
- Task 5 — visit event detection
- Tasks 6–11 — UI components in dependency order (StatusLabel → ProgressCounter → PlanetCanvas → HeadlinePlanet → ProgressPip → ProgressCard)
- Task 12 — useProgress hook
- Task 13 — ProgressCardWidget shell
- Tasks 14–15 — scene wiring
- Task 16 — CSS keyframes
- Task 17 — manual smoke test

Every task ends with `pnpm typecheck` and a green test run for the touched file(s). At every task boundary, `pnpm check` passes.
