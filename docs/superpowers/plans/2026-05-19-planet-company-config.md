# Planet & Company Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the planet & company data model from [`2026-05-19-planet-company-config-design.md`](../specs/2026-05-19-planet-company-config-design.md). Each company in the resume becomes a planet in the scene; the data model separates planet visuals from company info, joined under a `CompanyEntry` root.

**Architecture:** Hexagonal — types under `features/scene/types/`, consumers under `services/`, `components/`, `widget/`. One composite root (`CompanyEntry`) with narrow consumer-port projections (`PlanetProjection`, `LabelProjection`, `RevealProjection`). Proximity events carry full payload (`info` + `placement`) so no downstream `CompanyId → CompanyInfo` lookup is ever needed. The old `Company` type is removed in the same atomic migration that introduces `CompanyEntry` — no coexistence with the prior shape.

**Tech Stack:** TypeScript, React 19, React Three Fiber, @react-three/drei, XState v5, Zod (boundary parsing), Vitest.

---

## File structure

### New files

| Path | Responsibility |
|---|---|
| `src/features/scene/types/planet.ts` | `PlanetAssetId` (closed literal union), `PlanetConfig`. |
| `src/features/scene/types/period.ts` | `YearMonth`, `Period` (discriminated `closed \| ongoing`). |
| `src/features/scene/types/company-info.ts` | `CompanyInfo` (name, logo, role, period, description). |
| `src/features/scene/types/reveal-projection.ts` | `RevealProjection` (`hidden \| visible`). |
| `src/features/scene/types/projections.ts` | `PlanetProjection`, `LabelProjection` — narrow consumer-port projections of `CompanyEntry`. |
| `src/features/scene/components/Scene/PlanetLabels.tsx` | Always-visible name + logo above each planet (drei `<Html>`). |
| `src/features/scene/components/Scene/Planet.tsx` | Single-planet sprite renderer (loads its own texture via drei `useTexture`). Extracted because `useTexture` is a hook and cannot be called inside a `.map`. |
| `src/features/scene/widget/scene/companies.test.ts` | Sanity test for `getCompanyEntries()` — 5 entries, all `CompanyId`s unique, all `PlanetAssetId`s within the closed union. |

### Modified files

| Path | Change |
|---|---|
| `src/features/scene/types/company.ts` | Replace `Company` with `CompanyEntry`. Keep `CompanyId`, `asCompanyId` unchanged. |
| `src/features/scene/types/scene-event.ts` | `entered_proximity` carries `info` + `placement`; `exited_proximity` stays id-only. |
| `src/features/scene/services/renderer/proximityCheck.ts` | Generic signature `<T extends { placement }>(player, targets, radius) → ReadonlyArray<T>`. Math unchanged. |
| `src/features/scene/services/renderer/proximityCheck.test.ts` | Update fixtures to the generic shape. |
| `src/features/scene/widget/scene/companies.ts` | Replace 8 foundation stubs with 5 real `CompanyEntry` entries (Mave, 8fig, Riverside, StreamElements, TGS). Export `getCompanyEntries()`. |
| `src/features/scene/widget/scene/useScene.ts` | Read `CompanyEntry[]`; expose `state`, `entries`, `intents`, `onEvent`, `revealProjection`; manage `RevealProjection` from `SceneEvent` stream. |
| `src/features/scene/widget/scene/useScene.smoke.test.ts` | Update assertions to new return shape (`entries` instead of `companies`; add `revealProjection`). |
| `src/features/scene/widget/scene/SceneWidget.tsx` | Thread the new useScene fields into `<Scene />`. |
| `src/features/scene/components/Scene/Scene.tsx` | New prop shape: `state`, `entries`, `intents`, `onEvent`, `revealProjection`. Internally project `planets` + `labels` via `useMemo` and distribute to children. |
| `src/features/scene/components/Scene/Scene.test.tsx` | Update test fixtures to `CompanyEntry` + new prop shape. |
| `src/features/scene/components/Scene/Companies.tsx` | Consume `PlanetProjection[]`; delegate to `<Planet>` child. Replaces the cube + HSL-from-id placeholder. |
| `src/features/scene/components/Scene/ProximityWatcher.tsx` | Iterate `CompanyEntry[]` via the generic `proximityCheck`; emit `entered_proximity` with `info` + `placement` attached. |
| `src/features/scene/components/Scene/RevealOverlay.tsx` | New prop shape `{ info, placement }`. Renders a basic drei `<Html>` card with company name, role, period, description. |

### Out of band (author-supplied; not part of the plan)

- `public/logos/*.svg` — five logo files: `mave.svg`, `8fig.svg`, `riverside.svg`, `streamelements.svg`, `tgs.svg`. The plan ships with `<img>` references at these paths; if files are missing, the `<img>` tag shows a broken-image icon — no crash. Acquire the files separately.

---

## Task 1: `period.ts` — `YearMonth` + `Period`

**Files:**
- Create: `src/features/scene/types/period.ts`

- [ ] **Step 1: Create `period.ts`**

Write to `src/features/scene/types/period.ts`:

```typescript
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type YearMonth = {
  readonly year: number;
  readonly month: Month;
};

export type Period =
  | { readonly kind: 'closed'; readonly start: YearMonth; readonly end: YearMonth }
  | { readonly kind: 'ongoing'; readonly start: YearMonth };
```

Notes:
- `Month` is a literal union (not `number`) so `noUncheckedIndexedAccess` doesn't force a banned `!`/`??` suppressor when consumers need to translate a month into a name. The translator (Task 16) uses an exhaustive `switch` over `Month`; no "default" branch, no unreachable assert.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (new file is leaf, no consumers yet).

---

## Task 2: `planet.ts` — `PlanetAssetId` + `PlanetConfig`

**Files:**
- Create: `src/features/scene/types/planet.ts`

- [ ] **Step 1: Create `planet.ts`**

Write to `src/features/scene/types/planet.ts`:

```typescript
export type PlanetAssetId =
  | 'planet00'
  | 'planet01'
  | 'planet02'
  | 'planet03'
  | 'planet04'
  | 'planet05'
  | 'planet06'
  | 'planet07'
  | 'planet08'
  | 'planet09';

export type PlanetConfig = {
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

---

## Task 3: `company-info.ts` — `CompanyInfo`

**Files:**
- Create: `src/features/scene/types/company-info.ts`

- [ ] **Step 1: Create `company-info.ts`**

Write to `src/features/scene/types/company-info.ts`:

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

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

---

## Task 4: `reveal-projection.ts` — `RevealProjection`

**Files:**
- Create: `src/features/scene/types/reveal-projection.ts`

- [ ] **Step 1: Create `reveal-projection.ts`**

Write to `src/features/scene/types/reveal-projection.ts`:

```typescript
import type { CompanyInfo } from './company-info';

export type RevealProjection =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'visible';
      readonly info: CompanyInfo;
      readonly placement: readonly [number, number, number];
    };
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

---

## Task 5: `projections.ts` — `PlanetProjection`, `LabelProjection`

**Files:**
- Create: `src/features/scene/types/projections.ts`

- [ ] **Step 1: Create `projections.ts`**

Write to `src/features/scene/types/projections.ts`:

```typescript
import type { CompanyId } from './company';
import type { PlanetConfig } from './planet';

export type PlanetProjection = {
  readonly id: CompanyId;
  readonly planet: PlanetConfig;
};

export type LabelProjection = {
  readonly id: CompanyId;
  readonly placement: readonly [number, number, number];
  readonly companyName: string;
  readonly logoSrc: string;
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

---

## Task 6: `company.ts` — replace `Company` with `CompanyEntry`

**Files:**
- Modify: `src/features/scene/types/company.ts`

This task removes the old `Company` type. After this step, every consumer of `Company` is broken until subsequent tasks update them. The build will stay red until Task 16; that is expected. Do not commit until Task 17.

- [ ] **Step 1: Rewrite `company.ts`**

Write to `src/features/scene/types/company.ts` (replacing all current content):

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

- [ ] **Step 2: Run the company.test.ts invariant**

Run: `pnpm test src/features/scene/types/company.test.ts`
Expected: PASS — the two grep invariants (single `asCompanyId` definition, single `as CompanyId` cast) still hold; the test does not reference `Company`.

- [ ] **Step 3: Typecheck (build is red across consumers)**

Run: `pnpm typecheck`
Expected: FAIL — many errors of the form `Module '"./company"' has no exported member 'Company'`. These will be fixed by Tasks 7-16. Do not attempt to fix any yet; proceed.

---

## Task 7: `scene-event.ts` — extend `entered_proximity` payload

**Files:**
- Modify: `src/features/scene/types/scene-event.ts`

- [ ] **Step 1: Rewrite `scene-event.ts`**

Write to `src/features/scene/types/scene-event.ts` (replacing all current content):

```typescript
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

- [ ] **Step 2: Typecheck (still red)**

Run: `pnpm typecheck`
Expected: still FAIL across consumers. Proceed.

---

## Task 8: `proximityCheck.ts` — generic signature

**Files:**
- Modify: `src/features/scene/services/renderer/proximityCheck.ts`

- [ ] **Step 1: Rewrite `proximityCheck.ts`**

Write to `src/features/scene/services/renderer/proximityCheck.ts` (replacing all current content):

```typescript
import type { Vec3 } from './vec3';

type Placed = { readonly placement: readonly [number, number, number] };

export const proximityCheck = <T extends Placed>(
  playerPosition: Vec3,
  targets: ReadonlyArray<T>,
  radius: number,
): ReadonlyArray<T> => {
  const result: T[] = [];
  const limitSquared = radius * radius;
  for (const target of targets) {
    const [cx, cy, cz] = target.placement;
    const dx = cx - playerPosition.x;
    const dy = cy - playerPosition.y;
    const dz = cz - playerPosition.z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared <= limitSquared) {
      result.push(target);
    }
  }
  return result;
};
```

Notes on the change:
- Generic over `T extends { placement }`.
- Returns full `ReadonlyArray<T>` so the caller has each match in hand (no separate `id → entry` lookup ever needed).
- No reference to `Company`, `CompanyId`, or `position`. The math is unchanged.

- [ ] **Step 2: Typecheck (still red — test fixtures next)**

Run: `pnpm typecheck`
Expected: still FAIL. Proceed to Task 9 which updates the proximityCheck tests.

---

## Task 9: `proximityCheck.test.ts` — update fixtures to the generic shape

**Files:**
- Modify: `src/features/scene/services/renderer/proximityCheck.test.ts`

- [ ] **Step 1: Rewrite `proximityCheck.test.ts`**

Write to `src/features/scene/services/renderer/proximityCheck.test.ts` (replacing all current content):

```typescript
import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../types/company';
import type { CompanyId } from '../../types/company';
import { proximityCheck } from './proximityCheck';
import type { Vec3 } from './vec3';

type TestTarget = {
  readonly id: CompanyId;
  readonly placement: readonly [number, number, number];
};

const PLAYER: Vec3 = { x: 0, y: 0, z: 0 };

const target = (id: string, placement: readonly [number, number, number]): TestTarget => ({
  id: asCompanyId(id),
  placement,
});

const idsOf = (matches: ReadonlyArray<TestTarget>): ReadonlySet<CompanyId> =>
  new Set(matches.map((m) => m.id));

describe('proximityCheck', () => {
  it('returns an empty array when the targets list is empty', () => {
    const result = proximityCheck(PLAYER, [], 5);
    expect(result.length).toBe(0);
  });

  it('returns an empty array when no target lies within the radius', () => {
    const result = proximityCheck(PLAYER, [target('far', [100, 0, 0])], 5);
    expect(result.length).toBe(0);
  });

  it('includes a target strictly inside the radius', () => {
    const result = proximityCheck(PLAYER, [target('near', [2, 0, 0])], 5);
    expect(result.length).toBe(1);
    expect(idsOf(result).has(asCompanyId('near'))).toBe(true);
  });

  it('excludes a target strictly outside the radius', () => {
    const result = proximityCheck(PLAYER, [target('out', [10, 0, 0])], 5);
    expect(idsOf(result).has(asCompanyId('out'))).toBe(false);
  });

  it('includes a target exactly on the radius boundary (closed-disk semantics)', () => {
    const result = proximityCheck(PLAYER, [target('boundary', [5, 0, 0])], 5);
    expect(idsOf(result).has(asCompanyId('boundary'))).toBe(true);
  });

  it('computes Euclidean distance across all three axes', () => {
    const result = proximityCheck(PLAYER, [target('pythag', [3, 4, 0])], 5);
    expect(idsOf(result).has(asCompanyId('pythag'))).toBe(true);
  });

  it('excludes a target whose 3D distance exceeds the radius even when its 2D projection lies inside', () => {
    const result = proximityCheck(PLAYER, [target('above', [3, 4, 1])], 5);
    expect(idsOf(result).has(asCompanyId('above'))).toBe(false);
  });

  it('returns every in-range target when several lie inside the radius (independence across targets)', () => {
    const targets = [
      target('a', [1, 0, 0]),
      target('b', [0, 1, 0]),
      target('c', [0, 0, 1]),
    ];
    const result = proximityCheck(PLAYER, targets, 5);
    expect(result.length).toBe(3);
    const ids = idsOf(result);
    expect(ids.has(asCompanyId('a'))).toBe(true);
    expect(ids.has(asCompanyId('b'))).toBe(true);
    expect(ids.has(asCompanyId('c'))).toBe(true);
  });

  it('returns only in-range targets when a mixed list contains both in-range and out-of-range', () => {
    const targets = [
      target('in', [1, 0, 0]),
      target('out', [0, 0, 100]),
      target('also-in', [0, 2, 0]),
    ];
    const result = proximityCheck(PLAYER, targets, 5);
    const ids = idsOf(result);
    expect(ids.has(asCompanyId('in'))).toBe(true);
    expect(ids.has(asCompanyId('also-in'))).toBe(true);
    expect(ids.has(asCompanyId('out'))).toBe(false);
  });

  it('respects the radius parameter independently per call', () => {
    const targets = [target('mid', [4, 0, 0])];
    const wide = proximityCheck(PLAYER, targets, 5);
    const narrow = proximityCheck(PLAYER, targets, 3);
    expect(idsOf(wide).has(asCompanyId('mid'))).toBe(true);
    expect(idsOf(narrow).has(asCompanyId('mid'))).toBe(false);
  });

  it('does not mutate inputs', () => {
    const playerSnapshot: Vec3 = { x: PLAYER.x, y: PLAYER.y, z: PLAYER.z };
    const targets = [target('a', [1, 2, 3]), target('b', [4, 5, 6])];
    const targetsSnapshot = targets.map((t) => ({ id: t.id, placement: t.placement }));
    proximityCheck(PLAYER, targets, 5);
    expect(PLAYER).toEqual(playerSnapshot);
    expect(targets).toEqual(targetsSnapshot);
  });

  it('returns a fresh array instance on each call', () => {
    const targets = [target('a', [1, 0, 0])];
    const first = proximityCheck(PLAYER, targets, 5);
    const second = proximityCheck(PLAYER, targets, 5);
    expect(first).not.toBe(second);
  });
});
```

- [ ] **Step 2: Run proximityCheck tests in isolation**

Run: `pnpm test src/features/scene/services/renderer/proximityCheck.test.ts`
Expected: PASS — the generic-shape tests against the new generic signature succeed.

---

## Task 10: `companies.ts` — five real `CompanyEntry` entries

**Files:**
- Modify: `src/features/scene/widget/scene/companies.ts`

- [ ] **Step 1: Rewrite `companies.ts`**

Write to `src/features/scene/widget/scene/companies.ts` (replacing all current content):

```typescript
import { asCompanyId } from '../../types/company';
import type { CompanyEntry } from '../../types/company';

const RING_RADIUS = 14;
const RING_COUNT = 5;

const ringPosition = (index: number): readonly [number, number, number] => {
  const angle = (index / RING_COUNT) * Math.PI * 2;
  const x = Math.cos(angle) * RING_RADIUS;
  const z = Math.sin(angle) * RING_RADIUS;
  return [x, 0, z];
};

const COMPANY_ENTRIES: ReadonlyArray<CompanyEntry> = [
  {
    id: asCompanyId('mave'),
    planet: { assetId: 'planet00', placement: ringPosition(0) },
    info: {
      companyName: 'Mave',
      logoSrc: '/logos/mave.svg',
      role: 'Head of Platform',
      period: { kind: 'ongoing', start: { year: 2025, month: 1 } },
      description:
        "Employee #1, responsible for building the company's end-to-end product execution pipeline from ideation to production. Built the platform from scratch while defining the architecture, standards, and practices behind it. Partnered across product, design, R&D, and QA to drive technical decisions and scalable execution.",
    },
  },
  {
    id: asCompanyId('8fig'),
    planet: { assetId: 'planet01', placement: ringPosition(1) },
    info: {
      companyName: '8fig',
      logoSrc: '/logos/8fig.svg',
      role: 'Software Architect',
      period: {
        kind: 'closed',
        start: { year: 2023, month: 7 },
        end: { year: 2025, month: 1 },
      },
      description:
        "Owned critical product systems end to end, building the company's design system and turning ambiguous ideas into production-ready features. Re-architected the back-office platform and rebuilt the main dashboard, reducing load times from 8+ seconds to near-instant. Also set frontend quality standards, mentored engineers, and shaped the engineering interview process.",
    },
  },
  {
    id: asCompanyId('riverside'),
    planet: { assetId: 'planet02', placement: ringPosition(2) },
    info: {
      companyName: 'Riverside',
      logoSrc: '/logos/riverside.svg',
      role: 'Group Lead',
      period: {
        kind: 'closed',
        start: { year: 2022, month: 5 },
        end: { year: 2023, month: 4 },
      },
      description:
        'Joined as the sole engineer on the Editor team and rebuilt a neglected product from scratch, creating a stable foundation for scale. Partnered with leadership on the roadmap and long-term vision, and introduced a clear workflow for feature scoping, delivery, and approval across teams. Also built the engineering interview process and served as technical and execution lead as the product scaled from roughly 100 users to nearly 1M.',
    },
  },
  {
    id: asCompanyId('streamelements'),
    planet: { assetId: 'planet03', placement: ringPosition(3) },
    info: {
      companyName: 'StreamElements',
      logoSrc: '/logos/streamelements.svg',
      role: 'Senior Frontend Engineer',
      period: {
        kind: 'closed',
        start: { year: 2019, month: 10 },
        end: { year: 2022, month: 5 },
      },
      description:
        "Early engineer during the company's formative stage, building multiple products from scratch and leading rapid pivots as market conditions and priorities changed. During COVID-19, remained the sole engineer in the department after a major downsizing and owned critical initiatives during a high-pressure period. That work became foundational to the company's later growth, scale, and $100M SoftBank investment.",
    },
  },
  {
    id: asCompanyId('tgs'),
    planet: { assetId: 'planet04', placement: ringPosition(4) },
    info: {
      companyName: 'TGS',
      logoSrc: '/logos/tgs.svg',
      role: 'Frontend Engineer',
      period: {
        kind: 'closed',
        start: { year: 2018, month: 5 },
        end: { year: 2019, month: 10 },
      },
      description:
        'Frontend engineer on a complex, high-traffic travel engine used by major airline customers, including EasyJet and Singapore Airlines. Built a white-label frontend architecture for multiple enterprise clients.',
    },
  },
];

export const getCompanyEntries = (): ReadonlyArray<CompanyEntry> => COMPANY_ENTRIES;
```

- [ ] **Step 2: Typecheck (still red on the consumers; the data shape itself compiles)**

Run: `pnpm typecheck`
Expected: still FAIL on consumers, but no errors in `companies.ts` itself.

---

## Task 11: `companies.test.ts` — sanity invariants

**Files:**
- Create: `src/features/scene/widget/scene/companies.test.ts`

- [ ] **Step 1: Create `companies.test.ts`**

Write to `src/features/scene/widget/scene/companies.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getCompanyEntries } from './companies';

describe('getCompanyEntries', () => {
  it('returns exactly five entries', () => {
    expect(getCompanyEntries()).toHaveLength(5);
  });

  it('every CompanyId is unique', () => {
    const ids = getCompanyEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry carries a non-empty companyName, role, logoSrc, and description', () => {
    for (const entry of getCompanyEntries()) {
      expect(entry.info.companyName.length).toBeGreaterThan(0);
      expect(entry.info.role.length).toBeGreaterThan(0);
      expect(entry.info.logoSrc.length).toBeGreaterThan(0);
      expect(entry.info.description.length).toBeGreaterThan(0);
    }
  });

  it('every entry carries a YearMonth start with year ≥ 2000', () => {
    // month range is enforced structurally by `Month = 1 | ... | 12`; not retested here.
    for (const entry of getCompanyEntries()) {
      expect(entry.info.period.start.year).toBeGreaterThanOrEqual(2000);
    }
  });

  it('every closed period has an end YearMonth ≥ start YearMonth', () => {
    for (const entry of getCompanyEntries()) {
      const period = entry.info.period;
      if (period.kind === 'closed') {
        const startKey = period.start.year * 12 + period.start.month;
        const endKey = period.end.year * 12 + period.end.month;
        expect(endKey).toBeGreaterThanOrEqual(startKey);
      }
    }
  });

  it('every PlanetAssetId is within the closed union (planet00..planet09)', () => {
    const valid = new Set([
      'planet00',
      'planet01',
      'planet02',
      'planet03',
      'planet04',
      'planet05',
      'planet06',
      'planet07',
      'planet08',
      'planet09',
    ]);
    for (const entry of getCompanyEntries()) {
      expect(valid.has(entry.planet.assetId)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the new test in isolation**

Run: `pnpm test src/features/scene/widget/scene/companies.test.ts`
Expected: PASS.

---

## Task 12: `useScene.ts` — projections + `RevealProjection`

**Files:**
- Modify: `src/features/scene/widget/scene/useScene.ts`

- [ ] **Step 1: Rewrite `useScene.ts`**

Write to `src/features/scene/widget/scene/useScene.ts` (replacing all current content):

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActor } from '@xstate/react';
import { getSceneState, sceneMachine } from '../../../../core/scene/sceneMachine';
import { getCompanyEntries } from './companies';
import { subscribeToKeyboard } from '../../services/input/subscribeToKeyboard';
import type { CompanyEntry } from '../../types/company';
import type { Intent, IntentStream } from '../../types/intent';
import type { RevealProjection } from '../../types/reveal-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';

type UseSceneResult = {
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly revealProjection: RevealProjection;
};

const HIDDEN: RevealProjection = { kind: 'hidden' };

export const useScene = (): UseSceneResult => {
  const [snapshot, send] = useActor(sceneMachine);

  const intentSetRef = useRef<Set<Intent['kind']>>(new Set());
  const intents = useMemo<IntentStream>(
    () => ({ current: intentSetRef.current }),
    [],
  );

  const entries = useMemo<ReadonlyArray<CompanyEntry>>(
    () => getCompanyEntries(),
    [],
  );

  const [revealProjection, setRevealProjection] = useState<RevealProjection>(HIDDEN);

  useEffect(() => {
    const unsubscribe = subscribeToKeyboard((signal) => {
      switch (signal.kind) {
        case 'intent_down':
          intentSetRef.current.add(signal.intent);
          return;
        case 'intent_up':
          intentSetRef.current.delete(signal.intent);
          return;
        case 'command':
          send({ type: signal.command.kind });
      }
    });

    send({ type: 'start' });

    return unsubscribe;
  }, [send]);

  const onEvent = useCallback(
    (event: SceneEvent): void => {
      switch (event.kind) {
        case 'entered_proximity':
          setRevealProjection({
            kind: 'visible',
            info: event.info,
            placement: event.placement,
          });
          send({ type: 'entered_proximity', objectId: event.objectId });
          return;
        case 'exited_proximity':
          setRevealProjection(HIDDEN);
          send({ type: 'exited_proximity', objectId: event.objectId });
          return;
      }
    },
    [send],
  );

  const state = getSceneState(snapshot);

  return { state, entries, intents, onEvent, revealProjection };
};
```

Notes:
- `revealProjection` is React state. The `onEvent` handler updates it synchronously alongside the FSM `send`; React 18 batches both into one commit.
- The `console.log` calls present in the old version are removed — that was foundations-era demo instrumentation; production behavior emits no console output.
- The `interact` command path that previously logged is removed; the keyboard signal still routes to the FSM via `send({ type: 'interact' })`, the machine's `reduceOnInteract` is a no-op (unchanged).

- [ ] **Step 2: Typecheck (still red on Scene/components — next tasks)**

Run: `pnpm typecheck`
Expected: still FAIL on `Scene.tsx`, `Companies.tsx`, `ProximityWatcher.tsx`, `RevealOverlay.tsx`, `SceneWidget.tsx`, `Scene.test.tsx`, `useScene.smoke.test.ts`. The hook itself compiles.

---

## Task 13: `useScene.smoke.test.ts` — update to new shape

**Files:**
- Modify: `src/features/scene/widget/scene/useScene.smoke.test.ts`

- [ ] **Step 1: Rewrite `useScene.smoke.test.ts`**

Write to `src/features/scene/widget/scene/useScene.smoke.test.ts` (replacing all current content):

```typescript
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScene } from './useScene';

describe('useScene — composition root smoke', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { state, entries, intents, onEvent, revealProjection } with the expected shapes', () => {
    const { result } = renderHook(() => useScene());

    expect(typeof result.current.state.kind).toBe('string');
    expect(Array.isArray(result.current.entries)).toBe(true);
    expect(result.current.entries.length).toBeGreaterThan(0);
    expect(result.current.intents.current).toBeInstanceOf(Set);
    expect(typeof result.current.onEvent).toBe('function');
    expect(result.current.revealProjection.kind).toBe('hidden');
  });

  it('transitions from loading to playing after the start effect fires', () => {
    let initialKind = '';
    const { result } = renderHook(() => {
      const value = useScene();
      if (initialKind === '') {
        initialKind = value.state.kind;
      }
      return value;
    });

    expect(initialKind).toBe('loading');
    expect(result.current.state.kind).toBe('playing');
  });

  it('preserves the intents object identity across re-renders', () => {
    const { result, rerender } = renderHook(() => useScene());
    const intentsBefore = result.current.intents;

    act(() => {
      rerender();
    });

    expect(result.current.intents).toBe(intentsBefore);
  });
});
```

- [ ] **Step 2: Run the smoke test in isolation**

Run: `pnpm test src/features/scene/widget/scene/useScene.smoke.test.ts`
Expected: PASS.

---

## Task 14: `Companies.tsx` + `Planet.tsx` — sprite renderer

**Files:**
- Modify: `src/features/scene/components/Scene/Companies.tsx`
- Create: `src/features/scene/components/Scene/Planet.tsx`

The `useTexture` hook from drei cannot be called inside `.map()` (it's a React hook). Extract a `<Planet>` child component that loads its own texture.

- [ ] **Step 1: Create `Planet.tsx`**

Write to `src/features/scene/components/Scene/Planet.tsx`:

```typescript
import type { JSX } from 'react';
import { useTexture } from '@react-three/drei';
import type { PlanetProjection } from '../../types/projections';

type PlanetProps = {
  readonly planet: PlanetProjection;
};

const PLANET_SCALE: readonly [number, number, number] = [2.5, 2.5, 1];

export const Planet = (props: PlanetProps): JSX.Element => {
  const texture = useTexture(`/sprites/kenney-planets/${props.planet.planet.assetId}.png`);

  return (
    <sprite position={props.planet.planet.placement} scale={PLANET_SCALE}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  );
};
```

- [ ] **Step 2: Rewrite `Companies.tsx`**

Write to `src/features/scene/components/Scene/Companies.tsx` (replacing all current content):

```typescript
import type { JSX } from 'react';
import type { PlanetProjection } from '../../types/projections';
import { Planet } from './Planet';

type CompaniesProps = {
  readonly planets: ReadonlyArray<PlanetProjection>;
};

export const Companies = (props: CompaniesProps): JSX.Element => (
  <group>
    {props.planets.map((planet) => (
      <Planet key={planet.id} planet={planet} />
    ))}
  </group>
);
```

- [ ] **Step 3: Typecheck (still red on Scene, ProximityWatcher, RevealOverlay, tests)**

Run: `pnpm typecheck`
Expected: still FAIL on the remaining consumers. Proceed.

---

## Task 15: `PlanetLabels.tsx` — always-visible name + logo

**Files:**
- Create: `src/features/scene/components/Scene/PlanetLabels.tsx`

- [ ] **Step 1: Create `PlanetLabels.tsx`**

Write to `src/features/scene/components/Scene/PlanetLabels.tsx`:

```typescript
import type { CSSProperties, JSX } from 'react';
import { Html } from '@react-three/drei';
import type { LabelProjection } from '../../types/projections';

type PlanetLabelsProps = {
  readonly labels: ReadonlyArray<LabelProjection>;
};

const LABEL_OFFSET_Y = 2.5;

const LABEL_CONTAINER_STYLE: CSSProperties = {
  pointerEvents: 'none',
  transform: 'translate(-50%, -100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: '#ffffff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px',
  textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
  whiteSpace: 'nowrap',
};

const LOGO_STYLE: CSSProperties = {
  width: '32px',
  height: '32px',
  marginBottom: '4px',
};

export const PlanetLabels = (props: PlanetLabelsProps): JSX.Element => (
  <group>
    {props.labels.map((label) => {
      const [x, y, z] = label.placement;
      const position: readonly [number, number, number] = [x, y + LABEL_OFFSET_Y, z];
      return (
        <Html key={label.id} position={position} center>
          <div style={LABEL_CONTAINER_STYLE}>
            <img src={label.logoSrc} alt="" style={LOGO_STYLE} />
            <span>{label.companyName}</span>
          </div>
        </Html>
      );
    })}
  </group>
);
```

Notes:
- `Html` is anchored above the planet (`+LABEL_OFFSET_Y` on world Y).
- Inline styles are used because the project has no CSS infrastructure yet (per the `2026-05-19-3d-renderer-design.md` spec — styling is deferred). Polish via `styles-motion` agent in a later session.
- `alt=""` because the company name accompanies the logo in the same label — the image is decorative.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: still FAIL on Scene, ProximityWatcher, RevealOverlay, tests. Proceed.

---

## Task 16: `RevealOverlay.tsx` — basic reveal card

**Files:**
- Modify: `src/features/scene/components/Scene/RevealOverlay.tsx`

- [ ] **Step 1: Rewrite `RevealOverlay.tsx`**

Write to `src/features/scene/components/Scene/RevealOverlay.tsx` (replacing all current content):

```typescript
import type { CSSProperties, JSX } from 'react';
import { Html } from '@react-three/drei';
import type { CompanyInfo } from '../../types/company-info';
import type { Month, Period, YearMonth } from '../../types/period';

type RevealOverlayProps = {
  readonly info: CompanyInfo;
  readonly placement: readonly [number, number, number];
};

const REVEAL_OFFSET_Y = 3.5;

const CARD_STYLE: CSSProperties = {
  pointerEvents: 'none',
  transform: 'translate(-50%, -100%)',
  background: 'rgba(8, 12, 24, 0.92)',
  color: '#ffffff',
  padding: '12px 16px',
  borderRadius: '8px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '13px',
  lineHeight: 1.45,
  maxWidth: '320px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.45)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
};

const HEADING_STYLE: CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  marginBottom: '4px',
};

const META_STYLE: CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255, 255, 255, 0.72)',
  marginBottom: '8px',
};

const monthName = (month: Month): string => {
  switch (month) {
    case 1: return 'Jan';
    case 2: return 'Feb';
    case 3: return 'Mar';
    case 4: return 'Apr';
    case 5: return 'May';
    case 6: return 'Jun';
    case 7: return 'Jul';
    case 8: return 'Aug';
    case 9: return 'Sep';
    case 10: return 'Oct';
    case 11: return 'Nov';
    case 12: return 'Dec';
  }
};

const formatYearMonth = (ym: YearMonth): string =>
  `${monthName(ym.month)} ${ym.year}`;

const formatPeriod = (period: Period): string => {
  switch (period.kind) {
    case 'ongoing':
      return `${formatYearMonth(period.start)} – Present`;
    case 'closed':
      return `${formatYearMonth(period.start)} – ${formatYearMonth(period.end)}`;
  }
};

export const RevealOverlay = (props: RevealOverlayProps): JSX.Element => {
  const [x, y, z] = props.placement;
  const position: readonly [number, number, number] = [x, y + REVEAL_OFFSET_Y, z];

  return (
    <Html position={position} center>
      <div style={CARD_STYLE}>
        <div style={HEADING_STYLE}>{props.info.role}</div>
        <div style={META_STYLE}>{formatPeriod(props.info.period)}</div>
        <div>{props.info.description}</div>
      </div>
    </Html>
  );
};
```

Notes:
- `monthName` exhausts the `Month` literal union (`1` through `12`). No `default` case — TypeScript narrows to `string`. The `noUncheckedIndexedAccess: true` setting on the project would force a banned `!`/`??` suppressor if we instead indexed an array by `month - 1`; the switch sidesteps that.
- `formatPeriod` exhausts the `Period` discriminator with a `switch`.
- Card is positioned higher than the label (`REVEAL_OFFSET_Y = 3.5` vs `LABEL_OFFSET_Y = 2.5`) so it stacks above the always-visible name + logo.
- The label remains visible during reveal (no FSM gate hides it). Only the card appears/disappears.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: still FAIL on Scene, ProximityWatcher, tests. Proceed.

---

## Task 17: `ProximityWatcher.tsx` — iterate entries, emit with payload

**Files:**
- Modify: `src/features/scene/components/Scene/ProximityWatcher.tsx`

- [ ] **Step 1: Rewrite `ProximityWatcher.tsx`**

Write to `src/features/scene/components/Scene/ProximityWatcher.tsx` (replacing all current content):

```typescript
import type { JSX, RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { proximityCheck } from '../../services/renderer/proximityCheck';
import type { Kinematics } from '../../services/renderer/integrateMotion';
import type { CompanyEntry, CompanyId } from '../../types/company';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';

type ProximityWatcherProps = {
  readonly sceneState: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly onEvent: (event: SceneEvent) => void;
};

export const PROXIMITY_RADIUS = 3;

const EMPTY: ReadonlySet<CompanyId> = new Set<CompanyId>();

const emitsIn = (state: SceneState): boolean =>
  state.kind === 'playing' || state.kind === 'revealing';

const suppressesEnter = (state: SceneState, id: CompanyId): boolean =>
  state.kind === 'revealing' && state.objectId === id;

export const ProximityWatcher = (props: ProximityWatcherProps): JSX.Element => {
  const previousRef = useRef<ReadonlySet<CompanyId>>(EMPTY);

  useFrame(() => {
    if (!emitsIn(props.sceneState)) {
      previousRef.current = EMPTY;
      return;
    }

    const position = props.kinematicsRef.current.position;
    const matches = proximityCheck(position, props.entries, PROXIMITY_RADIUS);
    const previous = previousRef.current;
    const current = new Set<CompanyId>(matches.map((m) => m.id));

    for (const match of matches) {
      if (previous.has(match.id)) continue;
      if (suppressesEnter(props.sceneState, match.id)) continue;
      props.onEvent({
        kind: 'entered_proximity',
        objectId: match.id,
        info: match.info,
        placement: match.planet.placement,
      });
    }
    for (const id of previous) {
      if (!current.has(id)) {
        props.onEvent({ kind: 'exited_proximity', objectId: id });
      }
    }

    previousRef.current = current;
  });

  return <group />;
};
```

Notes:
- `proximityCheck` now returns `ReadonlyArray<CompanyEntry>` (because we pass `props.entries: ReadonlyArray<CompanyEntry>` and the generic infers `T = CompanyEntry`).
- Each match has `info` and `planet.placement` in hand — no lookup needed.
- The `current: Set<CompanyId>` is constructed inline for the diff against `previous`; only ids are tracked across frames (memory-tight).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: still FAIL on Scene + Scene.test + SceneWidget. Proceed.

---

## Task 18: `Scene.tsx` — new prop shape, internal projections

**Files:**
- Modify: `src/features/scene/components/Scene/Scene.tsx`

- [ ] **Step 1: Rewrite `Scene.tsx`**

Write to `src/features/scene/components/Scene/Scene.tsx` (replacing all current content):

```typescript
import type { JSX } from 'react';
import { useMemo } from 'react';
import type { CompanyEntry } from '../../types/company';
import type { IntentStream } from '../../types/intent';
import type { LabelProjection, PlanetProjection } from '../../types/projections';
import type { RevealProjection } from '../../types/reveal-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import { Companies } from './Companies';
import { FollowCamera } from './FollowCamera';
import { PlanetLabels } from './PlanetLabels';
import { Player } from './Player';
import { ProximityWatcher } from './ProximityWatcher';
import { RevealOverlay } from './RevealOverlay';
import { useSceneRefs } from './useSceneRefs';

type SceneProps = {
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly revealProjection: RevealProjection;
};

const projectPlanets = (
  entries: ReadonlyArray<CompanyEntry>,
): ReadonlyArray<PlanetProjection> =>
  entries.map((entry) => ({ id: entry.id, planet: entry.planet }));

const projectLabels = (
  entries: ReadonlyArray<CompanyEntry>,
): ReadonlyArray<LabelProjection> =>
  entries.map((entry) => ({
    id: entry.id,
    placement: entry.planet.placement,
    companyName: entry.info.companyName,
    logoSrc: entry.info.logoSrc,
  }));

export const Scene = (props: SceneProps): JSX.Element => {
  const { kinematicsRef, meshRef } = useSceneRefs();

  const planets = useMemo(() => projectPlanets(props.entries), [props.entries]);
  const labels = useMemo(() => projectLabels(props.entries), [props.entries]);

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} />
      <FollowCamera targetMeshRef={meshRef} />
      <Player
        sceneState={props.state}
        intents={props.intents}
        kinematicsRef={kinematicsRef}
        meshRef={meshRef}
      />
      <Companies planets={planets} />
      <PlanetLabels labels={labels} />
      <ProximityWatcher
        sceneState={props.state}
        entries={props.entries}
        kinematicsRef={kinematicsRef}
        onEvent={props.onEvent}
      />
      {props.revealProjection.kind === 'visible' ? (
        <RevealOverlay
          info={props.revealProjection.info}
          placement={props.revealProjection.placement}
        />
      ) : null}
    </>
  );
};
```

Notes:
- Reveal is gated on `revealProjection.kind === 'visible'`, not `state.kind === 'revealing'`. They're always in sync (same event handler updates both), but rendering off the projection means the renderer reads `info` and `placement` directly from a discriminated union narrow — no FSM-coupled lookup.
- `useMemo` ensures projections recompute only when `entries` identity changes (stable from `useScene`'s `useMemo(getCompanyEntries, [])`).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: still FAIL only on `Scene.test.tsx` and `SceneWidget.tsx`. Proceed.

---

## Task 19: `Scene.test.tsx` — new fixtures

**Files:**
- Modify: `src/features/scene/components/Scene/Scene.test.tsx`

- [ ] **Step 1: Rewrite `Scene.test.tsx`**

Write to `src/features/scene/components/Scene/Scene.test.tsx` (replacing all current content):

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { asCompanyId } from '../../types/company';
import type { CompanyEntry } from '../../types/company';
import type { IntentStream } from '../../types/intent';
import type { RevealProjection } from '../../types/reveal-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import { Scene } from './Scene';

vi.mock('@react-three/fiber', () => {
  const fakeCamera = {
    getWorldDirection: <T extends { set: (x: number, y: number, z: number) => T }>(target: T): T =>
      target.set(0, 0, -1),
  };
  return {
    useFrame: (): null => null,
    useThree: <T,>(selector: (state: { camera: typeof fakeCamera }) => T): T =>
      selector({ camera: fakeCamera }),
  };
});

vi.mock('@react-three/drei', () => ({
  PerspectiveCamera: (): null => null,
  Html: (): null => null,
  useTexture: (): { readonly placeholder: true } => ({ placeholder: true }),
}));

const acme = asCompanyId('acme');
const globex = asCompanyId('globex');

const acmeEntry: CompanyEntry = {
  id: acme,
  planet: { assetId: 'planet00', placement: [5, 0, 0] },
  info: {
    companyName: 'Acme',
    logoSrc: '/logos/acme.svg',
    role: 'Engineer',
    period: { kind: 'ongoing', start: { year: 2024, month: 1 } },
    description: 'Acme description.',
  },
};

const globexEntry: CompanyEntry = {
  id: globex,
  planet: { assetId: 'planet01', placement: [-5, 0, 0] },
  info: {
    companyName: 'Globex',
    logoSrc: '/logos/globex.svg',
    role: 'Architect',
    period: {
      kind: 'closed',
      start: { year: 2020, month: 6 },
      end: { year: 2023, month: 12 },
    },
    description: 'Globex description.',
  },
};

const emptyIntents = (): IntentStream => ({ current: new Set() });

const twoEntries = (): ReadonlyArray<CompanyEntry> => [acmeEntry, globexEntry];

const hidden: RevealProjection = { kind: 'hidden' };

const mount = (
  state: SceneState,
  entries: ReadonlyArray<CompanyEntry>,
  intents: IntentStream,
  onEvent: (event: SceneEvent) => void,
  revealProjection: RevealProjection = hidden,
): void => {
  render(
    <Scene
      state={state}
      entries={entries}
      intents={intents}
      onEvent={onEvent}
      revealProjection={revealProjection}
    />,
  );
};

afterEach(() => {
  cleanup();
});

describe('Scene — mount smoke', () => {
  it('renders without throwing when state = { kind: "loading" }, empty entries, empty intent stream', () => {
    expect(() => mount({ kind: 'loading' }, [], emptyIntents(), vi.fn())).not.toThrow();
  });

  it('renders without throwing when state = { kind: "playing" } and a non-empty entries list', () => {
    expect(() => mount({ kind: 'playing' }, twoEntries(), emptyIntents(), vi.fn())).not.toThrow();
  });

  it('renders without throwing when state = { kind: "revealing", objectId } with matching visible reveal projection', () => {
    const visible: RevealProjection = {
      kind: 'visible',
      info: acmeEntry.info,
      placement: acmeEntry.planet.placement,
    };
    expect(() =>
      mount(
        { kind: 'revealing', objectId: acme },
        twoEntries(),
        emptyIntents(),
        vi.fn(),
        visible,
      ),
    ).not.toThrow();
  });

  it('renders without throwing when state = { kind: "paused", resumeTo: { kind: "playing" } }', () => {
    expect(() =>
      mount(
        { kind: 'paused', resumeTo: { kind: 'playing' } },
        twoEntries(),
        emptyIntents(),
        vi.fn(),
      ),
    ).not.toThrow();
  });
});

describe('Scene — port purity at mount', () => {
  it('does not invoke onEvent at mount under any SceneState variant', () => {
    const onEvent = vi.fn();
    mount({ kind: 'loading' }, twoEntries(), emptyIntents(), onEvent);
    cleanup();
    mount({ kind: 'playing' }, twoEntries(), emptyIntents(), onEvent);
    cleanup();
    mount({ kind: 'revealing', objectId: acme }, twoEntries(), emptyIntents(), onEvent);
    cleanup();
    mount(
      { kind: 'paused', resumeTo: { kind: 'playing' } },
      twoEntries(),
      emptyIntents(),
      onEvent,
    );
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('does not mutate the entries array across a mount + unmount cycle', () => {
    const entries = twoEntries();
    const snapshotLength = entries.length;
    mount({ kind: 'playing' }, entries, emptyIntents(), vi.fn());
    cleanup();
    expect(entries.length).toBe(snapshotLength);
    expect(entries).toEqual([acmeEntry, globexEntry]);
  });

  it('does not replace the IntentStream object identity or write to its current set', () => {
    const initialSet = new Set<'move_forward'>();
    const intents: IntentStream = { current: initialSet };
    mount({ kind: 'playing' }, twoEntries(), intents, vi.fn());
    expect(intents.current).toBe(initialSet);
    expect(intents.current.size).toBe(0);
  });
});
```

Notes:
- The drei mock adds `useTexture` returning a placeholder; the Planet component never inspects the texture in tests.
- `Html` is mocked to render nothing, so the new `<PlanetLabels />` and `<RevealOverlay />` are inert under test.

- [ ] **Step 2: Run Scene tests in isolation**

Run: `pnpm test src/features/scene/components/Scene/Scene.test.tsx`
Expected: PASS.

---

## Task 20: `SceneWidget.tsx` — thread new useScene fields

**Files:**
- Modify: `src/features/scene/widget/scene/SceneWidget.tsx`

- [ ] **Step 1: Rewrite `SceneWidget.tsx`**

Write to `src/features/scene/widget/scene/SceneWidget.tsx` (replacing all current content):

```typescript
import type { CSSProperties, JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '../../components/Scene/Scene';
import { useScene } from './useScene';

const CANVAS_WRAPPER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
};

export const SceneWidget = (): JSX.Element => {
  const { state, entries, intents, onEvent, revealProjection } = useScene();

  return (
    <Canvas style={CANVAS_WRAPPER_STYLE} dpr={[1, 2]}>
      <Scene
        state={state}
        entries={entries}
        intents={intents}
        onEvent={onEvent}
        revealProjection={revealProjection}
      />
    </Canvas>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS — every file compiles. Build is green.

---

## Task 21: Full check + manual verification

- [ ] **Step 1: Full pipeline check**

Run: `pnpm check`
Expected: PASS — typecheck, oxlint, lint:suppressors, and vitest all green.

If any suppressor warning fires, **do not add `// oxlint-disable`**. The rule is firing because the type is wrong somewhere. Open the offending file and re-shape the producer.

- [ ] **Step 2: Dev server smoke**

Run: `pnpm dev` (in a separate terminal).

Open the printed URL (usually `http://localhost:5173`). Verify in the browser:

- A ring of 5 sprite-billboard planets appears around the origin.
- Each planet has a label above it — logo image (broken-image icon is fine if `public/logos/*.svg` are not yet supplied) + company name.
- Press `W`/`A`/`S`/`D` (or arrow keys) — the player sphere moves.
- Approach any planet — a card with role, period, and description appears anchored above the label.
- Move away — the card disappears; the label remains.
- Press `Escape` — pause; movement freezes. Press `Escape` again — resume; the card reappears if you're still inside the radius.

Stop the dev server with `Ctrl-C`.

- [ ] **Step 3: Commit**

```bash
git add \
  src/features/scene/types/planet.ts \
  src/features/scene/types/period.ts \
  src/features/scene/types/company-info.ts \
  src/features/scene/types/reveal-projection.ts \
  src/features/scene/types/projections.ts \
  src/features/scene/types/company.ts \
  src/features/scene/types/scene-event.ts \
  src/features/scene/services/renderer/proximityCheck.ts \
  src/features/scene/services/renderer/proximityCheck.test.ts \
  src/features/scene/widget/scene/companies.ts \
  src/features/scene/widget/scene/companies.test.ts \
  src/features/scene/widget/scene/useScene.ts \
  src/features/scene/widget/scene/useScene.smoke.test.ts \
  src/features/scene/widget/scene/SceneWidget.tsx \
  src/features/scene/components/Scene/Scene.tsx \
  src/features/scene/components/Scene/Scene.test.tsx \
  src/features/scene/components/Scene/Companies.tsx \
  src/features/scene/components/Scene/Planet.tsx \
  src/features/scene/components/Scene/PlanetLabels.tsx \
  src/features/scene/components/Scene/ProximityWatcher.tsx \
  src/features/scene/components/Scene/RevealOverlay.tsx

git commit -m "$(cat <<'EOF'
feat(scene): introduce CompanyEntry + planet/company data model

Replace the foundations-era Company placeholder with a composite
CompanyEntry rooting planet visual config (PlanetConfig) and company
info content (CompanyInfo) under one CompanyId. Each consumer receives
only its narrow port projection. entered_proximity now carries info +
placement so no downstream CompanyId → CompanyInfo lookup exists.

Five real entries (Mave, 8fig, Riverside, StreamElements, TGS) on a
ring of radius 14, each assigned a kenney-planets sprite.

Spec: docs/superpowers/specs/2026-05-19-planet-company-config-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds; no pre-commit hook failures.

- [ ] **Step 4: Final status check**

Run: `git status`
Expected: clean working tree.

Run: `git log --oneline -5`
Expected: the new commit is at HEAD; prior history (camera-relative motion, Kenney curation, etc.) is intact below it.

---

## Self-review

**Spec coverage:**
- `PlanetAssetId` + `PlanetConfig` → Task 2
- `YearMonth` + `Period` → Task 1
- `CompanyInfo` → Task 3
- `CompanyEntry` (replaces `Company`) → Task 6
- `RevealProjection` → Task 4
- `PlanetProjection` + `LabelProjection` → Task 5
- `proximityCheck` generic signature → Task 8 (+ test fixtures Task 9)
- `SceneEvent.entered_proximity` carries `info` + `placement` → Task 7
- Widget `RevealProjection` state management → Task 12
- New `<PlanetLabels />` → Task 15
- Updated `<RevealOverlay />` → Task 16
- Updated `<Companies />` (sprite renderer) + `<Planet />` extraction → Task 14
- Updated `<ProximityWatcher />` (iterates entries, emits payload) → Task 17
- Updated `<Scene />` (5-prop port + internal projections) → Task 18
- Updated `<SceneWidget />` → Task 20
- Updated tests (proximityCheck, companies, useScene smoke, Scene smoke) → Tasks 9, 11, 13, 19
- 5 real `CompanyEntry` entries (Mave, 8fig, Riverside, StreamElements, TGS) → Task 10
- Atomic single-commit migration (no `Company`/`CompanyEntry` coexistence) → Task 6 deletes `Company`; commit happens only at Task 21.

**Placeholder scan:** no "TBD", "TODO", "later", or "for now" in any task. Every step contains complete code. Period helper, ring helper, sprite child, label component, reveal card — all fully written.

**Type consistency:**
- `RevealProjection` discriminator: `hidden | visible`. Used identically in `useScene.ts` (Task 12), `Scene.tsx` (Task 18), `Scene.test.tsx` (Task 19), `reveal-projection.ts` (Task 4).
- `Period` discriminator: `closed | ongoing`. Used in `period.ts` (Task 1), `company-info.ts` (Task 3), `companies.ts` (Task 10), `RevealOverlay.tsx` (Task 16).
- `PlanetAssetId` literal union: `planet00 .. planet09`. Used in `planet.ts` (Task 2), `companies.ts` (Task 10 — only `planet00..planet04` assigned), `companies.test.ts` (Task 11), `Planet.tsx` (Task 14).
- `CompanyEntry`: `{ id, planet, info }`. Consistent across all consumers.
- `SceneEvent.entered_proximity` payload: `{ kind, objectId, info, placement }`. Consistent in `scene-event.ts` (Task 7), `useScene.ts` (Task 12), `ProximityWatcher.tsx` (Task 17).
- `useScene` return shape: `{ state, entries, intents, onEvent, revealProjection }`. Consistent across `useScene.ts` (Task 12), `useScene.smoke.test.ts` (Task 13), `SceneWidget.tsx` (Task 20).
- `Scene` props shape: `{ state, entries, intents, onEvent, revealProjection }`. Consistent across `Scene.tsx` (Task 18), `Scene.test.tsx` (Task 19), `SceneWidget.tsx` (Task 20).

**Suppressor sweep:** no `!`, no `as` casts other than `as CompanyId` (single-source minter), no `??` on lookup results, no `@ts-*`, no `eslint-disable` / `oxlint-disable`. The `switch` in `formatPeriod` (Task 16) and `onEvent` (Task 12) exhausts the discriminator; no default case, no unreachable branch.

**Scope:** the plan is one cohesive migration. All files change atomically toward the single goal stated in the spec. No unrelated refactors snuck in.

---

## Notes for the implementer

- **Do not commit until Task 21.** Tasks 6-19 leave the build red in the middle (e.g., `Company` is deleted in Task 6, but `Scene.tsx` still imports it until Task 18). This is expected. Verify the build is green at Task 21 before committing.
- **If you're tempted to write `??` or `!`** anywhere in the new code: stop. The producer side needs to be reshaped. The proximity event already carries the payload — there should be no nullable lookup anywhere downstream.
- **If you find an unused import** during the work, delete it. Iron Law 4: no half-finished implementations.
- **If a test references the old `Company` type or `position` field**, that test needs updating in this plan. If you encounter one not in the file list above, surface it before writing code — it may indicate a file the spec missed.
