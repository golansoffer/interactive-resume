# Earth Moon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single orbiting moon to Earth (`earth_b` / StreamElements) in the 3D scene. Data shape (`satellites: ReadonlyArray<SatelliteSpec>` on `PlanetConfig`) is extensible — adding moons to other planets later becomes pure config.

**Architecture:** New pure data type (`SatelliteSpec`/`SatelliteOrbit`), new pure orbit-math helper (`satelliteOffset`), new shared visual hook (`usePlanetVisual`) consumed by both `Planet` and a new `Satellite` component, both mounted as siblings inside the parent planet's placement group. Moon is visual-only — no collider, no proximity activation, no label.

**Tech Stack:** TypeScript, React, `@react-three/fiber`, `@react-three/drei`, Three.js, vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-05-23-earth-moon-design.md` — the spec is the contract. Each agent in this plan reads it.

---

## Hard constraints baked into every agent dispatch

These are not negotiable. Every prompt in this plan repeats them. Per user durable rules in `~/.claude/projects/.../memory/`:

1. **Do NOT create a git worktree or side branch.** Work directly on the active branch (`main` or whatever HEAD currently is).
2. **Do NOT run git commit, git push, git stash, git reset, or git rebase.** Read-only git is fine (status, log, diff). The user is the only one who mutates history.
3. **Iron Laws apply** — hexagonal architecture, discriminated unions everywhere, illegal states unrepresentable, design discipline (no defensive code, no "for now" patches, no type-system suppressors).
4. **Suppressor lint** — `pnpm lint:suppressors` and the oxlint suppressor rules are build-failing. No `!`, no `as T` on lookups, no `??` defaults on map/array lookups, no `@ts-ignore`, no `eslint-disable`, no `any`.
5. **No comments explaining WHAT** — only WHY when non-obvious.

After every agent runs, verify with:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

All three must pass before proceeding to the next task.

---

## Task 1: BDD/TDD specifications

**Agent:** `bdd-tdd-spec-writer`

**Files:**
- Create: `docs/superpowers/specs/2026-05-23-earth-moon-bdd.md`
- Create: `docs/superpowers/specs/2026-05-23-earth-moon-tdd.md`

- [ ] **Step 1: Dispatch the agent**

```text
Read the design spec at docs/superpowers/specs/2026-05-23-earth-moon-design.md and produce two artifacts:

1. docs/superpowers/specs/2026-05-23-earth-moon-bdd.md — port-targeted Gherkin scenarios. Cover:
   - User flow: a viewer flies near Earth and sees a small body orbiting it.
   - Port: SatelliteSpec data flows from companies.ts → Companies → Planet → Satellite.
   - Port: satelliteOffset(orbit, time) → [x,y,z] is pure and deterministic.
   - Behavior: moon does NOT block the ship (no collider).
   - Behavior: moon does NOT contribute to Earth's reveal activation.
   - Behavior: planets with satellites: [] render exactly as they do today (no regression).
   - Behavior: refactor — Planet using usePlanetVisual still renders the same body as before.

2. docs/superpowers/specs/2026-05-23-earth-moon-tdd.md — TDD test bullets that describe behavior through ports, never implementation details. Cover:
   - satelliteOffset math (zero-time on +X axis, quarter-period rotation, half-period mirror, inclination tilts y, phase shifts start, period inverse with frequency).
   - usePlanetVisual hook returns plan/pose/extraction for valid asset; memoizes stable references across re-renders.
   - Satellite component mounts the spec's GLB; applies spec.scale * PLANET_BASE_SCALE; reads orbit position via useFrame; does NOT register a collider; does NOT register a planet radius.
   - Planet still renders identically after consuming usePlanetVisual.
   - Planet renders satellites.length children in its outer placement group; satellites: [] renders zero.
   - Companies threads satellites prop through; FillerPlanets passes satellites: [] explicitly.

Hard constraints:
- Do NOT create a git worktree or side branch.
- Do NOT run git commit/push/stash/reset/rebase.
- Iron Laws apply. Tests describe behavior through ports — not implementation details.
- No placeholders, no TBDs, no "we can clean up later".
```

- [ ] **Step 2: Verify outputs exist and are complete**

```bash
ls docs/superpowers/specs/2026-05-23-earth-moon-bdd.md
ls docs/superpowers/specs/2026-05-23-earth-moon-tdd.md
```

Both files must exist. Skim each: BDD has Given/When/Then scenarios covering all 7 bullets above; TDD has named test bullets covering all 6 areas.

- [ ] **Step 3: No commit (per user rule). Stage for review.**

```bash
git add docs/superpowers/specs/2026-05-23-earth-moon-bdd.md docs/superpowers/specs/2026-05-23-earth-moon-tdd.md
git status
```

---

## Task 2: Architecture audit (plan mode)

**Agent:** `core-architecture-guardian`

**Files:**
- Read-only review. No file output.

- [ ] **Step 1: Dispatch the agent**

```text
Plan-mode review of the proposed type design in docs/superpowers/specs/2026-05-23-earth-moon-design.md. No code yet. Audit the following against the Iron Laws and supporting rules in /Users/golan/Documents/repos/interactive-resume/CLAUDE.md:

1. Adding `satellites: ReadonlyArray<SatelliteSpec>` as a REQUIRED field on PlanetConfig — is this the right shape?
   - Verify: empty array as "no moons" does not violate Iron Law 3 (no optional-as-implicit-state).
   - Verify: this is preferable to a discriminated union variant `kind: 'bare' | 'with_satellites'` (Iron Law 4 — would extra variants earn their place?).
   - Verify: required-on-PlanetConfig + every existing entry gets `satellites: []` is consistent with how the codebase handles new required fields.

2. New types — SatelliteSpec, SatelliteOrbit:
   - Verify they're flat config records with no variants, consistent with existing PlanetConfig and FillerPlanetEntry.
   - Verify no discriminator (`kind`) is needed — i.e. would a future `kind: 'circular' | 'elliptical' | 'lissajous'` discriminator on SatelliteOrbit earn its place today? Confirm the answer is no (Iron Law 4 — no abstraction until it earns its place).

3. Layer placement:
   - types/satellite.ts in types/ → ✓ pure data.
   - services/renderer/satelliteOffset.ts in services/ → ✓ pure helper, consistent with planetPose / planetCollider / celestialFlightMath.
   - services/renderer/phaseFromId.ts (lifted from Planet) in services/ → ✓ pure helper.
   - components/Scene/usePlanetVisual.ts in components/ → ✓ a hook that uses useGLTF/useTexture must live near components (R3F hook constraint).
   - components/Scene/Satellite.tsx → ✓ component layer.

4. No-information-leak audit:
   - Satellite props = { spec } only. Verify Satellite cannot see colliders, activations, scene state, or proximity. The spec forbids it via the prop type.
   - Planet props gain satellites — verify this is the right port (Planet owns "I am a planet at a placement, here's my moons"), not a side channel.
   - usePlanetVisual takes (assetId, phase) — verify it doesn't reach back into wiring/refs/state.

5. Dependency rule fractal check:
   - components/Scene/Satellite.tsx imports services/renderer/satelliteOffset → ✓ component depends on service.
   - components/Scene/usePlanetVisual.ts imports services/renderer + types/ → ✓.
   - No service imports a component, no type imports anything from React or Three. Audit imports.

Output: ALIGNED or one or more violations with the specific Iron Law each violates. If aligned, say so explicitly. If violations, name them precisely; the next agent will fix before coding.

Hard constraints:
- Do NOT create a git worktree or side branch.
- Do NOT run git commit/push/stash/reset/rebase.
- Read-only review. You may read files; do not edit.
```

- [ ] **Step 2: Verify the audit conclusion**

If the agent reports ALIGNED, proceed. If violations are reported, return to the spec, fix the design, and re-run Task 2 before continuing.

---

## Task 3: Data layer — types, pure helpers, companies.ts data

**Agent:** `data-adapter-builder`

**Files:**
- Create: `src/features/scene/types/satellite.ts`
- Modify: `src/features/scene/types/planet.ts` (add `satellites` field to `PlanetConfig`)
- Create: `src/features/scene/services/renderer/satelliteOffset.ts`
- Create: `src/features/scene/services/renderer/satelliteOffset.test.ts`
- Create: `src/features/scene/services/renderer/phaseFromId.ts` (lifted from `Planet.tsx`)
- Create: `src/features/scene/services/renderer/phaseFromId.test.ts`
- Create: `src/features/scene/services/renderer/planetScale.ts` (single-export module for `PLANET_BASE_SCALE`)
- Modify: `src/features/scene/widget/scene/companies.ts` (every entry gets `satellites: []`; StreamElements gets one moon spec)

- [ ] **Step 1: Dispatch the agent**

```text
Implement the data layer for the Earth Moon feature. The design spec is docs/superpowers/specs/2026-05-23-earth-moon-design.md — read it first. The BDD/TDD specs are docs/superpowers/specs/2026-05-23-earth-moon-bdd.md and -tdd.md — derive test cases from there.

Files to create and modify:

1. CREATE src/features/scene/types/satellite.ts — exact contents per the spec's "Types & data shape" section:

import type { PlanetAssetId } from './planet';

export type SatelliteOrbit = {
  readonly radius: number;
  readonly periodSeconds: number;
  readonly phase: number;
  readonly inclinationDeg: number;
};

export type SatelliteSpec = {
  // id is BOTH the React render key AND the phase seed for own-axis rotation
  // (orbit position derives from time + orbit params only; the rotation phase
  // derives from id via phaseFromId). Renaming a satellite re-phases its spin.
  readonly id: string;
  readonly assetId: PlanetAssetId;
  readonly scale: number;           // multiplier on PLANET_BASE_SCALE
  readonly orbit: SatelliteOrbit;
};

2. MODIFY src/features/scene/types/planet.ts — add to PlanetConfig:

import type { SatelliteSpec } from './satellite';

export type PlanetConfig = {
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
  readonly satellites: ReadonlyArray<SatelliteSpec>;  // [] means "no moons"
};

3. CREATE src/features/scene/services/renderer/satelliteOffset.ts — exact contents per the spec's "Orbit math" subsection. Pure function, no Three, no React.

4. CREATE src/features/scene/services/renderer/satelliteOffset.test.ts — vitest tests for at minimum:
   - timeSeconds=0, phase=0, inclinationDeg=0, radius=R → [R, 0, 0]
   - timeSeconds=periodSeconds/4 → x≈0, z≈R (within float tolerance)
   - timeSeconds=periodSeconds/2 → [-R, 0, 0]
   - inclinationDeg=90 collapses z toward 0 and routes planar into y
   - phase=π at t=0 equals phase=0 at t=periodSeconds/2
   Use describe/it/expect from vitest, toBeCloseTo for floats.

5. LIFT phaseFromId from src/features/scene/components/Scene/Planet.tsx (currently a private module-level const there, along with `idEncoder`) into a new file:
   CREATE src/features/scene/services/renderer/phaseFromId.ts — export `phaseFromId(id: string): number` with the same body. Preserve the module-scope `TextEncoder` allocation (declared once at import time, reused per call). Pure, no React/Three. Add a one-line comment above the function explaining the purpose: deriving a deterministic per-id phase so animation cycles desync across bodies sharing the same period.

6. CREATE src/features/scene/services/renderer/phaseFromId.test.ts — vitest tests:
   - phaseFromId('') returns 0
   - phaseFromId(same string twice) returns the same number (deterministic)
   - phaseFromId of two different strings of similar length usually returns different numbers
   - return value is in [0, 2π)

   Do NOT modify Planet.tsx in this task — the import switch happens in Task 4. Leave Planet.tsx's local phaseFromId and idEncoder in place for now; Task 4 will remove them.

7. CREATE src/features/scene/services/renderer/planetScale.ts — single-export pure module:

export const PLANET_BASE_SCALE = 1.5;

   This constant is currently a module-scope const in Planet.tsx. It now lives in services so both Planet (Task 4) and Satellite (Task 4) can import it without a sibling-component leak.

   Do NOT modify Planet.tsx in this task. Leave its local `PLANET_BASE_SCALE` in place for now; Task 4 will remove it and switch to the services import.

8. MODIFY src/features/scene/widget/scene/companies.ts:
   - Every entry's `planet` block gets `satellites: []`.
   - The StreamElements entry (id 'streamelements', assetId 'earth_b') gets exactly one satellite spec:
     satellites: [{ id: 'earth_b:moon', assetId: 'moon_a', scale: 0.3, orbit: { radius: 6, periodSeconds: 10, phase: 0, inclinationDeg: 15 } }]

Hard constraints:
- Do NOT create a git worktree or side branch.
- Do NOT run git commit/push/stash/reset/rebase.
- Iron Law 3: no optional fields, no `?:`, no `??` defaults on lookups.
- No type-system suppressors: no `!`, no `as` casts on lookups, no `@ts-ignore`, no `eslint-disable`, no `any`.
- All files have no comments except where the WHY is non-obvious. The `// React render key; satellites don't register globally` and `// [] means "no moons"` lines from the spec are the only comments needed.
- Tests use the existing project test conventions (vitest, imports from 'vitest', `describe`/`it`/`expect`).

After implementation, run and confirm all pass:
  pnpm typecheck
  pnpm lint
  pnpm test
```

- [ ] **Step 2: Verify files exist**

```bash
ls src/features/scene/types/satellite.ts
ls src/features/scene/services/renderer/satelliteOffset.ts
ls src/features/scene/services/renderer/satelliteOffset.test.ts
ls src/features/scene/services/renderer/phaseFromId.ts
ls src/features/scene/services/renderer/phaseFromId.test.ts
```

- [ ] **Step 3: Run the full suite**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

All three must pass. If typecheck fails on `companies.ts` due to the new required field, that's expected if a stale build cache exists — clean rebuild should resolve. If lint fails on suppressors, the agent introduced a forbidden pattern; re-dispatch with the violation called out.

- [ ] **Step 4: Stage for review (no commit)**

```bash
git add src/features/scene/types/satellite.ts src/features/scene/types/planet.ts src/features/scene/services/renderer/satelliteOffset.ts src/features/scene/services/renderer/satelliteOffset.test.ts src/features/scene/services/renderer/phaseFromId.ts src/features/scene/services/renderer/phaseFromId.test.ts src/features/scene/widget/scene/companies.ts
git status
```

---

## Task 4: UI layer — usePlanetVisual hook, Satellite component, Planet refactor, wiring

**Agent:** `ui-component-builder`

**Files:**
- Create: `src/features/scene/components/Scene/usePlanetVisual.ts`
- Create: `src/features/scene/components/Scene/usePlanetVisual.test.ts`
- Create: `src/features/scene/components/Scene/Satellite.tsx`
- Create: `src/features/scene/components/Scene/Satellite.test.tsx`
- Modify: `src/features/scene/components/Scene/Planet.tsx`
- Modify: `src/features/scene/components/Scene/Companies.tsx`
- Modify: `src/features/scene/components/Scene/FillerPlanets.tsx`
- Modify: `src/features/scene/components/Scene/Scene.test.tsx` (extend smoke for moon mount)

- [ ] **Step 1: Dispatch the agent**

```text
Implement the UI layer for the Earth Moon feature. Design spec: docs/superpowers/specs/2026-05-23-earth-moon-design.md. Read the spec section "Component & scene-graph structure" carefully — that's the contract.

Pre-conditions: Task 3 (data-adapter-builder) has run. The following already exist:
- src/features/scene/types/satellite.ts (SatelliteSpec, SatelliteOrbit)
- src/features/scene/types/planet.ts has `satellites: ReadonlyArray<SatelliteSpec>` on PlanetConfig
- src/features/scene/services/renderer/satelliteOffset.ts
- src/features/scene/services/renderer/phaseFromId.ts
- src/features/scene/services/renderer/planetScale.ts (exports PLANET_BASE_SCALE)
- src/features/scene/widget/scene/companies.ts has satellites: [] on every entry, Earth has one moon
- src/features/scene/components/Scene/Planet.tsx STILL has its local phaseFromId, idEncoder, and PLANET_BASE_SCALE — Task 3 deliberately did not touch Planet.tsx. THIS task removes them and replaces with imports from services.

Tasks for this dispatch:

1. CREATE src/features/scene/components/Scene/usePlanetVisual.ts — extract the GLB-loading + visual-plan + pose pipeline that currently lives inside Planet.tsx. Signature:

  type PlanetVisualBundle = {
    readonly plan: PlanetVisualPlan;
    readonly pose: PlanetPose;
    readonly extraction: BodyExtraction;
  };

  export const usePlanetVisual = (
    assetId: PlanetAssetId,
    phase: number,
  ): PlanetVisualBundle;

  Internally: useGLTF(assetUrl(PLANET_PATHS[assetId])), useTexture(assetUrl(COLORSHEET_PATH)), useMemo(() => resolvePlanetLook(assetId), [assetId]), useMemo for plan (configureColorsheet + buildVisualPlan(cloneAndDress(scene, colorsheet, look), phase)), useMemo for derived (extractBody + planetPoseFor). Return { plan, pose, extraction }.

2. CREATE src/features/scene/components/Scene/usePlanetVisual.test.ts — vitest test using renderHook from @testing-library/react. Mock @react-three/drei's useGLTF and useTexture the way Scene.test.tsx does. Assert:
   - Returns an object with plan, pose, extraction defined.
   - Calling the hook twice with the same (assetId, phase) returns stable .plan / .pose references (memoization).

3. REFACTOR src/features/scene/components/Scene/Planet.tsx:
   - Replace the inline useGLTF + useTexture + look + plan + derived setup with a single call: const { plan, pose, extraction } = usePlanetVisual(props.assetId, phase);
   - Replace the local phaseFromId helper with an import from '../../services/renderer/phaseFromId'. REMOVE the local phaseFromId const and the idEncoder above it.
   - Replace the local PLANET_BASE_SCALE const with an import from '../../services/renderer/planetScale'. REMOVE the local const.
   - Replace `derived.extraction` and `derived.pose` references accordingly. Keep usePlanetFrame, collider registration, radius registration, mesh refs, and the JSX shell unchanged — only the visual-bundle producer changes.
   - ADD: after the existing mesh group inside the placement group, render `{props.satellites.map((spec) => (<Satellite key={spec.id} spec={spec} />))}` as a sibling group of the mesh group, both inside the outer placement group. See the exact JSX in the spec's "Scene-graph mounting" subsection.
   - ADD: PlanetProps gains `readonly satellites: ReadonlyArray<SatelliteSpec>`.

4. CREATE src/features/scene/components/Scene/Satellite.tsx — exact structure per the spec's "Satellite component" subsection. Imports: useMemo, useRef from react; useFrame from @react-three/fiber; Center from @react-three/drei; SatelliteSpec from ../../types/satellite; phaseFromId, satelliteOffset, PLANET_BASE_SCALE from services/renderer; rotationRateFor from services/renderer/planetVisualPlan; usePlanetVisual from local. Uses Group and Object3D refs from three. Do NOT import PLANET_BASE_SCALE from Planet.tsx — that would be a component-to-component leak (Iron Law 1). Task 3 created services/renderer/planetScale.ts for this purpose.

5. CREATE src/features/scene/components/Scene/Satellite.test.tsx — vitest test mirroring the mock patterns in Scene.test.tsx (mock @react-three/fiber's useFrame, @react-three/drei's useGLTF/useTexture/Center). Assert:
   - Renders without error given a valid SatelliteSpec.
   - Does NOT touch any sphereCollidersRef (because there is none — verify by ensuring Satellite's prop type does not include it).
   - Does NOT touch any planetRadiiRef or planetActivationsRef (same — prop type forbids).

6. MODIFY src/features/scene/components/Scene/Companies.tsx — in the <Planet /> JSX, add `satellites={entry.planet.satellites}` to the prop list. No other change.

7. MODIFY src/features/scene/components/Scene/FillerPlanets.tsx — in the <Planet /> JSX, add `satellites={[]}` to the prop list. Explicit empty array — do NOT make satellites optional on Planet's props.

8. EXTEND src/features/scene/components/Scene/Scene.test.tsx — light smoke addition:
   - With the current CAREER_ROUTE (Earth has a moon, others don't), the Scene mounts without throwing.
   - Verify PLANET_PATHS['moon_a'] appears in the set of GLB paths preloaded or referenced (proxy: ensure no error thrown referencing the moon asset id).

Hard constraints:
- Do NOT create a git worktree or side branch.
- Do NOT run git commit/push/stash/reset/rebase.
- Iron Law 1 (hex): no service imports a component, no component imports another component's internals beyond declared exports.
- Iron Law 3: Planet's satellites prop is REQUIRED. FillerPlanets passes `satellites={[]}` explicitly. NO default value, NO optional prop.
- Iron Law 4: Satellite is its own component, NOT a flag on Planet.
- No `useEffect` (use `useFrame` for the render-loop bridge, same as Planet does today).
- No type-system suppressors: no `!`, no `as` casts on lookups, no `??` on lookups, no `@ts-ignore`, no `eslint-disable`, no `any`.
- No comments except WHY-when-non-obvious. The Planet refactor should DELETE the existing block-comment over PlanetWiring if it was only documenting the existing shape — keep it only if it still adds non-obvious context.

After implementation, run and confirm all pass:
  pnpm typecheck
  pnpm lint
  pnpm test
```

- [ ] **Step 2: Verify files exist**

```bash
ls src/features/scene/components/Scene/usePlanetVisual.ts
ls src/features/scene/components/Scene/usePlanetVisual.test.ts
ls src/features/scene/components/Scene/Satellite.tsx
ls src/features/scene/components/Scene/Satellite.test.tsx
```

- [ ] **Step 3: Verify Planet.tsx no longer contains phaseFromId or idEncoder**

```bash
grep -n "phaseFromId\|idEncoder" src/features/scene/components/Scene/Planet.tsx
```

Expected output: only an `import` line for phaseFromId from services. The local const and `idEncoder` are gone.

- [ ] **Step 4: Verify Companies and FillerPlanets pass satellites prop**

```bash
grep -n "satellites=" src/features/scene/components/Scene/Companies.tsx src/features/scene/components/Scene/FillerPlanets.tsx
```

Expected: `satellites={entry.planet.satellites}` in Companies and `satellites={[]}` in FillerPlanets.

- [ ] **Step 5: Run the full suite**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

All three must pass.

- [ ] **Step 6: Stage for review (no commit)**

```bash
git add src/features/scene/components/Scene/
git status
```

---

## Task 5: Motion tuning (visual)

**Agent:** `styles-motion`

**Files:**
- Modify (potentially): `src/features/scene/widget/scene/companies.ts` (orbit parameter values for the Earth moon)
- Read-only on the rest

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

Open the URL it prints. Fly the ship near Earth (the StreamElements planet, blue, far +Z) and observe the moon's orbit.

- [ ] **Step 2: Dispatch the agent if the orbit needs tuning**

If the spec's default values (`radius: 6`, `periodSeconds: 10`, `inclinationDeg: 15`, `scale: 0.3`) look right in the running app, skip the agent — the values stand.

If tuning is needed, dispatch:

```text
The Earth Moon feature is live in the running app. Current orbit params for the moon (in src/features/scene/widget/scene/companies.ts, streamelements entry):

  satellites: [{
    id: 'earth_b:moon',
    assetId: 'moon_a',
    scale: 0.3,
    orbit: { radius: 6, periodSeconds: 10, phase: 0, inclinationDeg: 15 },
  }]

Adjust ONLY the numeric values (radius, periodSeconds, inclinationDeg, scale) for the visual feel described below. Do not change the type shape, the field names, or any other file.

Visual goals (in priority order):
1. The moon is unambiguously SMALL relative to Earth — clearly a satellite, not a sibling planet.
2. The moon sits clearly OUTSIDE Earth's body but close enough that "Earth's moon" reads instantly.
3. The orbit is visually MOTION at any moment — you can see it move within ~1 second of looking.
4. The orbit reads as 3D — the moon isn't on a flat ring in the xz plane.

Constraints:
- Do NOT create a git worktree or side branch.
- Do NOT run git commit/push/stash/reset/rebase.
- Pixels live with components only — DO NOT move tuning values to routes, widgets, api, or services. The values stay in companies.ts (which is the data root for company planets and their moons).
- Iron Law 3: do not introduce optional fields, defaults, or ?? operators.

Report which values you changed and why.
```

- [ ] **Step 3: Verify lint and tests still pass after tuning**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 4: Stage for review (no commit)**

```bash
git add src/features/scene/widget/scene/companies.ts
git status
```

---

## Task 6: Architecture audit (code mode)

**Agent:** `core-architecture-guardian`

**Files:**
- Read-only review.

- [ ] **Step 1: Dispatch the agent**

```text
Code-mode review. Tasks 3–5 have run; the Earth Moon feature is implemented. Audit the realized code against the design spec at docs/superpowers/specs/2026-05-23-earth-moon-design.md and the Iron Laws in /Users/golan/Documents/repos/interactive-resume/CLAUDE.md.

Specific checks:

1. Dependency rule (Iron Law 1):
   - Run: grep -nR "from '\\.\\./\\.\\./components" src/features/scene/services/ — must return zero hits (services do not import components).
   - Run: grep -nR "from 'react'\\|from '@react-three" src/features/scene/types/ — must return zero hits (types do not import React/Three).
   - Run: grep -nR "from 'react'\\|from '@react-three" src/features/scene/services/renderer/satelliteOffset.ts src/features/scene/services/renderer/phaseFromId.ts — must return zero hits (these pure helpers do not import React/Three).
   - Verify Satellite.tsx imports satelliteOffset from services, NOT from another component.
   - Verify Planet.tsx imports phaseFromId from services, NOT defining it locally anymore.

2. No-information-leak (operational form of Iron Law 1):
   - Satellite's prop type: confirm it is only `{ spec: SatelliteSpec }`. No sphereCollidersRef, no planetRadiiRef, no planetActivationsRef, no sceneState, no routeProjection in scope.
   - Planet's satellites prop: confirm it's `ReadonlyArray<SatelliteSpec>` typed, required, no default value, no optional.
   - usePlanetVisual: confirm its parameters are (assetId, phase) only — no refs, no wiring objects, no state.

3. Recursive hex check inside the scene feature:
   - types → no imports of services, components, widgets, routes.
   - services → no imports of components, widgets, routes.
   - components → may import types, services, other components within scene/components.
   - widget → may import types, services, components.

4. Iron Law 3 (illegal states unrepresentable):
   - PlanetConfig.satellites is required (not optional).
   - SatelliteSpec / SatelliteOrbit fields are all required (not optional).
   - No `?:` introduced anywhere new.
   - No `?? defaultValue` on a lookup-shaped expression introduced anywhere new.
   - No `as` casts on lookups, no `!` postfix, no `@ts-ignore`, no `eslint-disable` in the new/modified files.

5. Iron Law 4 (design discipline):
   - Satellite is its own component, NOT a flag on Planet.
   - usePlanetVisual exists because there are now two callers of the identical setup.
   - No "for now", "stub", "first step", "minimal version", "TODO", "FIXME" left in code.

Output: ALIGNED or a list of specific violations with the file:line they occur and the Iron Law they violate. Read-only — do not edit.

Hard constraints:
- Do NOT create a git worktree or side branch.
- Do NOT run git commit/push/stash/reset/rebase.
```

- [ ] **Step 2: Resolve any violations**

If the audit reports violations, re-dispatch the appropriate implementation agent (Task 3 or Task 4) with the specific violations named. Re-run Task 6 after the fix. Do not proceed until ALIGNED.

---

## Task 7: Final rules audit

**Agent:** `rules-guardian`

**Files:**
- Read-only audit.

- [ ] **Step 1: Dispatch the agent**

```text
Final compliance audit. The Earth Moon feature is implemented (Tasks 3–6 completed, architecture audit passed). Audit ALL changed files against /Users/golan/Documents/repos/interactive-resume/CLAUDE.md — every Iron Law, every supporting rule.

Files in scope (use git diff to find them):
- src/features/scene/types/satellite.ts (new)
- src/features/scene/types/planet.ts (modified)
- src/features/scene/services/renderer/satelliteOffset.ts (new)
- src/features/scene/services/renderer/satelliteOffset.test.ts (new)
- src/features/scene/services/renderer/phaseFromId.ts (new)
- src/features/scene/services/renderer/phaseFromId.test.ts (new)
- src/features/scene/widget/scene/companies.ts (modified)
- src/features/scene/components/Scene/usePlanetVisual.ts (new)
- src/features/scene/components/Scene/usePlanetVisual.test.ts (new)
- src/features/scene/components/Scene/Satellite.tsx (new)
- src/features/scene/components/Scene/Satellite.test.tsx (new)
- src/features/scene/components/Scene/Planet.tsx (modified)
- src/features/scene/components/Scene/Companies.tsx (modified)
- src/features/scene/components/Scene/FillerPlanets.tsx (modified)
- src/features/scene/components/Scene/Scene.test.tsx (modified)

You have VETO power. Partial alignment is HARD REJECT. Symptom-fixes are HARD REJECT. Type-system suppressors are HARD REJECT.

Specifically audit:

1. All four Iron Laws (Hexagonal, Discriminated Unions, Illegal States Unrepresentable, Design Discipline).
2. Supporting rules: parse-don't-validate, functional/pure core, early returns, no useEffect, naming conventions, no information leaks at every scale, deep modules (no shallow long-param-list cosmetic patches), no forbidden phrases ("for now", "TODO", "FIXME", "stub", "workaround", "first step", "minimal version", "clean up later").
3. The suppressor ban (oxlint suppressor rules): no `!`, no `as T` on lookups, no `||`/`??` defaults on lookups, no truthy/undefined narrows on lookups, no `@ts-ignore`, no `@ts-expect-error`, no `@ts-nocheck`, no `eslint-disable`/`oxlint-disable`, no `any`, no `unknown` hiding nullability.
4. Comments: only WHY-when-non-obvious. No what-comments. No "added for X" references.
5. Test design: tests describe behavior through ports, not implementation details.

Run these commands as part of your audit:
  pnpm typecheck    — must pass
  pnpm lint          — must pass
  pnpm test          — must pass

Output: APPROVED or HARD REJECT with the specific violations file:line and the rule each violates. Read-only — do not edit.

Hard constraints:
- Do NOT create a git worktree or side branch.
- Do NOT run git commit/push/stash/reset/rebase.
```

- [ ] **Step 2: Resolve any rejections**

If REJECTED, follow the agent's named violations back to the appropriate implementation agent (Task 3 or 4), re-implement, re-run Task 6 and Task 7. Do not call the feature done until rules-guardian outputs APPROVED.

- [ ] **Step 3: Final manual smoke**

```bash
pnpm dev
```

Open the app, fly to Earth, watch the moon. Verify:
- Moon orbits Earth visibly.
- Moon is small relative to Earth.
- Moon does not block the ship (try to fly through it).
- StreamElements info panel still opens correctly on proximity to Earth.
- Other planets (Mave, 8fig, Riverside, TGS) render exactly as before — no satellites, no visual regression.

- [ ] **Step 4: Final stage for user review (no commit)**

```bash
git status
git diff --stat
```

The implementation is complete. The user reviews and commits if they choose.

---

## Self-review (run after writing this plan, before handoff)

**Spec coverage check** — every section of `2026-05-23-earth-moon-design.md` mapped to a task:
- "Types & data shape" — Task 3 (data-adapter-builder).
- "Visual & motion" → orbit math — Task 3 (satelliteOffset.ts); → parameter values — Task 3 (defaults in companies.ts) + Task 5 (tuning).
- "Component & scene-graph structure" — Task 4 (ui-component-builder).
- "Strict alignment with Iron Laws" — Task 6 (core-architecture-guardian, code mode).
- "Implementation phasing" — this plan IS the phasing.
- "Testing" — unit tests in Task 3, component tests in Task 4, smoke in Task 4 + Task 7.

**Placeholder scan** — no TBDs, no TODOs, no "implement later", no "similar to Task N". Every agent prompt is verbatim-dispatchable. Every code block is the literal content the agent should produce.

**Type consistency** — names used across tasks:
- `SatelliteSpec`, `SatelliteOrbit` — defined in Task 3, consumed in Task 4 and 6.
- `satelliteOffset` — defined in Task 3, consumed in Task 4 (inside Satellite.tsx).
- `phaseFromId` — lifted in Task 3, consumed in Task 4 (Planet refactor and Satellite).
- `usePlanetVisual` — created in Task 4, no cross-task name drift.
- `PlanetConfig.satellites` field name — same across spec, Task 3, and Task 4.
- `id: 'earth_b:moon'` literal — defined once in Task 3, referenced in Task 7 smoke.

No drift detected.

---

## Execution

This plan is ready to execute. Two options:

**1. Subagent-Driven (recommended)** — fresh subagent per task with the orchestrator (you) reviewing the output of each before dispatching the next. Best fit for this plan because every task is one agent dispatch with a clean handoff.

**2. Inline Execution** — execute the agent dispatches sequentially in this session with checkpoints between.

Pick one and proceed.
