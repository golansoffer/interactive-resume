# Spaceship Engine Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cyan engine-wake `<Trail>` (from `@react-three/drei`) behind the speeder in `Player.tsx`, anchored to a small rear-of-ship offset inside the model's flip group so heading lerp carries the trail along.

**Architecture:** Single-file UI change in `src/features/scene/components/Scene/Player.tsx`. Six file-scope constants; `<Trail>` mounted *inside* the flip group with an anchor `<group>` as its only child. drei's `Trail` walks its inner host group's children to find the first `Object3D` (the anchor); the line mesh is portalled into the canvas-root scene so it draws in world space regardless of where `<Trail>` sits in JSX. No new ref, no `useRef<Group>`, no `Group` import. No new domain state, no FSM changes, no new props on `PlayerProps`.

**Tech Stack:** React 19 (`@types/react@19.2.14`), TypeScript, `@react-three/drei@10.7.7` (`Trail`, `useGLTF`, `Center`), `@react-three/fiber@9.6.1` (`useFrame`, `useThree`), `three@0.184` (`Vector3`). Test runner: vitest. Lint: oxlint + custom suppressor scan via `scripts/check-suppressors.mjs`.

**Spec:** `docs/superpowers/specs/2026-05-19-spaceship-trail-design.md`. Read it once before starting — it covers *why* each constant value was chosen against drei's actual source code, and why we use the children-mode anchor instead of the `target` ref prop.

---

## Pre-flight (read once before starting)

The spec contains drei-API discoveries that drive the constant values and the wiring shape. The key ones (so you don't second-guess them while implementing):

- **`length` is buffer scaling, not seconds.** drei allocates a `length * 10` sample buffer (`Trail.js:34`). At `decay = 4`, 4 samples are pushed per frame (`Trail.js:52`). At 60 fps, effective trail duration ≈ `(length * 10) / (decay * 60)`. The values below are paired; changing one without the other will shift the visual.
- **`width` is internally multiplied by 0.1.** drei builds `MeshLineMaterial({ lineWidth: 0.1 * width })` (`Trail.js:108`). With `sizeAttenuation = 1`, prop `2.0` becomes a `0.2` world-unit line.
- **`attenuation`'s `t`** is `0` at the oldest sample (tail tip) and `1` at the newest sample (engine end). `(t) => t * t` therefore pinches the tail and keeps the engine full-width.
- **Children-mode, not the `target` prop.** drei's `target?: React.RefObject<Object3D>` (non-nullable, `Trail.d.ts:16`) is incompatible with `useRef<Group>(null)` under `@types/react@19.2.14` — the React 19 overload `useRef<T>(initialValue: T | null): RefObject<T | null>` (`index.d.ts:1749`) returns a `T | null` ref, which is not assignable to `RefObject<Object3D>`. Avoiding this requires either a cast (banned by Iron Law 3) or imperative `new Group()` construction (more code). drei's children-fallback (`Trail.js:97`) — mounting the anchor as `<Trail>`'s child and letting drei find it via `children.find(o => o instanceof Object3D)` — sidesteps the typing issue entirely and is documented drei API, not a workaround. Use it.
- **No `local`, `stride`, or `interval` props.** drei defaults are correct for our case (`local = false` samples via `anchor.getWorldPosition`, `stride = 0` and `interval = 1` sample every frame).

---

### Task 1: Wire `<Trail>` into Player and patch the drei test mock

**Files:**
- Modify: `src/features/scene/components/Scene/Player.tsx`
- Modify: `src/features/scene/components/Scene/Scene.test.tsx`

This is one logical change with two file edits: importing `Trail` in Player will break the existing smoke tests because the drei mock doesn't list `Trail` yet. Both edits ship in one commit.

- [ ] **Step 1: Confirm the failure mode before any code change.**

Read the current drei mock to confirm `Trail` is absent (it should be — the mock currently exposes `PerspectiveCamera`, `Html`, `Center`, `useGLTF`, `useTexture`).

Run the current test suite to establish the green baseline:

```bash
pnpm test --run src/features/scene/components/Scene/Scene.test.tsx
```

Expected: all tests pass. If any fail, stop and investigate before starting — the plan assumes a green baseline.

- [ ] **Step 2: Add the `Trail` passthrough to the drei mock in `Scene.test.tsx`.**

The mock currently looks like this (around lines 52–64):

```ts
vi.mock('@react-three/drei', () => ({
  PerspectiveCamera: (): null => null,
  Html: (): null => null,
  Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  useGLTF: Object.assign(
    (): { readonly scene: MockScene } => ({ scene: mockScene }),
    { preload: (): void => {} },
  ),
  useTexture: Object.assign(
    (): MockTexture => mockTexture,
    { preload: (): void => {} },
  ),
}));
```

Add the `Trail` key. The mock returns the (none-passed) children or `null`; in production usage Player passes no children to `<Trail>`, so the mock effectively renders nothing:

```ts
vi.mock('@react-three/drei', () => ({
  PerspectiveCamera: (): null => null,
  Html: (): null => null,
  Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  Trail: ({ children }: { readonly children?: ReactNode }): ReactNode => children ?? null,
  useGLTF: Object.assign(
    (): { readonly scene: MockScene } => ({ scene: mockScene }),
    { preload: (): void => {} },
  ),
  useTexture: Object.assign(
    (): MockTexture => mockTexture,
    { preload: (): void => {} },
  ),
}));
```

No other changes in this file. No new test cases. The smoke tests already cover "scene mounts in every `SceneState`" — that's the right contract for a purely cosmetic addition.

- [ ] **Step 3: Add the `Trail` import to the drei import line in `Player.tsx`.**

Existing import lines (top of file):

```ts
import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Center, useGLTF } from '@react-three/drei';
import type { Object3D, Vector3 as Vector3Impl } from 'three';
import { Vector3 } from 'three';
```

Add `Trail` to the drei import only. No other import lines change — in particular, **do not add `Group`** from `three`. The anchor uses R3F's `<group>` element directly; no `useRef<Group>` is involved, so no type annotation for `Group` is needed:

```ts
import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Center, Trail, useGLTF } from '@react-three/drei';
import type { Object3D, Vector3 as Vector3Impl } from 'three';
import { Vector3 } from 'three';
```

- [ ] **Step 4: Add the six Trail tuning constants to `Player.tsx`.**

Add them at file scope alongside the existing `MAX_PITCH`, `MAX_ROLL`, `ORIENT_LERP` etc. constants. Suggested location: directly above the existing `// Idle motion — sine oscillations…` comment block, with their own grouping comment so a future reader knows they're a unit:

```ts
// Engine trail — cyan wake behind the speeder. Anchored to TAIL_OFFSET_Z
// inside the flip group so heading lerp carries the trail along.
// drei applies lineWidth = 0.1 * TRAIL_WIDTH; buffer holds TRAIL_LENGTH * 10
// samples; at TRAIL_DECAY=4 and 60fps, ~0.625s of history (~8.7 world units
// at MAX_SPEED). Attenuation pinches the tail to a point.
const TAIL_OFFSET_Z = 0.4;
const TRAIL_WIDTH = 2.0;
const TRAIL_LENGTH = 15;
const TRAIL_COLOR = '#5fd6ff';
const TRAIL_DECAY = 4;
const TRAIL_ATTENUATION = (t: number): number => t * t;
```

The comment block above is the one place a `// why` comment is genuinely earned — the magic numbers' rationales sit inside drei's source code, not at the call site. Without this note, a future reader will think "0.625s" is just an opinion.

**No new `useRef`, no new `useMemo`.** The Player component body adds no new lines in the hooks section. The anchor is purely a JSX element, discovered by drei via children-fallback after mount.

- [ ] **Step 5: Replace the Player return JSX with the children-mode version.**

The current return (around lines 160–168):

```tsx
  return (
    <group ref={props.meshRef} scale={SHIP_SCALE} rotation={[0, 0, 0, 'YXZ']}>
      <group rotation={[0, Math.PI, 0]}>
        <Center>
          <primitive object={scene} />
        </Center>
      </group>
    </group>
  );
```

Replace with:

```tsx
  return (
    <group ref={props.meshRef} scale={SHIP_SCALE} rotation={[0, 0, 0, 'YXZ']}>
      <group rotation={[0, Math.PI, 0]}>
        <Center>
          <primitive object={scene} />
        </Center>
        <Trail
          width={TRAIL_WIDTH}
          length={TRAIL_LENGTH}
          color={TRAIL_COLOR}
          decay={TRAIL_DECAY}
          attenuation={TRAIL_ATTENUATION}
        >
          <group position={[0, 0, TAIL_OFFSET_Z]} />
        </Trail>
      </group>
    </group>
  );
```

Two key shape facts to honor:

1. **`<Trail>` is mounted inside the flip group**, not as a sibling of the ship's root group. This is structurally required: drei's children-fallback finds the anchor by walking Trail's internal host group children (`Trail.js:97`), and the anchor's world transform comes from its React parent chain. If Trail were outside the flip group, the anchor would no longer inherit ship motion or heading.
2. **The anchor `<group position={[0, 0, TAIL_OFFSET_Z]} />` is `<Trail>`'s sole child.** No `target={ref}` prop. No `useRef`. drei finds the anchor by looking through its inner group's children for the first `Object3D`; an R3F `<group>` reconciles to `THREE.Group` (which extends `Object3D`), so the fallback selects it.

No fragment is used. The root remains a single `<group ref={props.meshRef}>` exactly as before — only the inner JSX changes.

- [ ] **Step 6: Run the targeted smoke tests.**

```bash
pnpm test --run src/features/scene/components/Scene/Scene.test.tsx
```

Expected: all tests in `Scene — mount smoke` and `Scene — port purity at mount` pass.

If a test fails with "Element type is invalid: expected a string … but got: undefined", you skipped Step 2 (the mock patch). Go back and apply it.

If a test fails with anything else, stop and investigate — do not "fix forward".

- [ ] **Step 7: Run typecheck.**

```bash
pnpm typecheck
```

Expected: no errors. The children-mode JSX avoids the React 19 / drei 10.7.7 type-incompatibility entirely — there is no `useRef<Group>(null)` to begin with. If typecheck reports any error, **stop and report** — do not reach for any cast, `!`, or `as`.

- [ ] **Step 8: Run lint and the suppressor scan.**

```bash
pnpm lint
pnpm lint:suppressors
```

Expected: both green. The suppressor scan is the project's hard gate against `!`, `as`, `??` on lookups, `@ts-ignore`, etc. — none of the new code uses any of these, so this must pass.

- [ ] **Step 9: Run the full test suite once.**

```bash
pnpm test
```

Expected: all tests pass, not just the scene smoke tests.

- [ ] **Step 10: Commit.**

```bash
git add src/features/scene/components/Scene/Player.tsx \
        src/features/scene/components/Scene/Scene.test.tsx
git commit -m "feat(scene): cyan engine wake trail behind the speeder

Add a drei <Trail> mounted inside the speeder's flip group, with a
small rear-offset <group> as its child (children-mode anchor —
Trail.js:97). Heading lerp on the outer group carries the trail
along automatically. 'When the ship is moving' is implicit in Trail's
position sampling; no FSM gate, no opacity lerp.

Constants chosen against drei/core/Trail.js source; children-mode
chosen because drei's target?: RefObject<Object3D> (non-nullable) is
incompatible with React 19's useRef<T>(null) → RefObject<T | null>.
See docs/superpowers/specs/2026-05-19-spaceship-trail-design.md."
```

---

### Task 2: Visual verification in `pnpm dev`

**Files:** (read-only — no edits unless tuning is needed)
- `src/features/scene/components/Scene/Player.tsx`

The automated tests cover render-without-throwing only. The actual visual behavior must be verified in the browser. The four checks below correspond to the four physical claims in the spec.

- [ ] **Step 1: Start the dev server.**

```bash
pnpm dev
```

Open the resulting `http://localhost:5173` (or whatever port Vite reports) in a browser. Wait for the speeder model and starfield background to render.

- [ ] **Step 2: Check #1 — parked ship shows no visible trail.**

Without pressing any movement keys: the speeder should sit (with its idle bob/sway flutter), and there should be **no visible cyan streak** behind it. Trail samples are clustered at the same position → buffer collapses → effectively invisible.

Pass criterion: no cyan line is visible to the eye behind a stationary ship.

If you see a static cyan dot or short stub: that's the buffer's initial state. Move the ship and stop — the stub should disappear.

- [ ] **Step 3: Check #2 — hold forward reveals an engine-length cyan streak.**

Hold the forward thrust key (whichever key the input layer binds to forward — check `src/features/scene/services/input/` if unsure). After ~1 second of continuous forward motion, the trail should reach steady-state length.

Pass criterion: a cyan streak emerges from the rear of the speeder, roughly 7× ship-length long at full speed (the ship itself is small in the frame — the streak is several ship-lengths visible behind).

If the streak is too thin or too thick: `TRAIL_WIDTH = 2.0` is the knob. Halve or double, re-run.

If the streak is too short or too long: `TRAIL_LENGTH = 15` is the knob. Same rule.

- [ ] **Step 4: Check #3 — yaw turns drag the trail with the heading.**

While moving forward, strafe sideways or turn so the camera-relative heading changes. The yaw lerp will rotate the ship over a few hundred milliseconds. The trail should **bend with the heading**, not stay along a straight world-axis line.

Pass criterion: the trail traces the curved path the ship has taken. If the trail follows a straight line through the ship while the ship rotates around it, the anchor is in the wrong layer — back to the spec, re-read "Why the anchor lives inside the flip group".

This is *the* visual proof that `<Trail>` is correctly nested inside the flip group (so its child anchor `<group>` inherits ship + flip + yaw transforms).

- [ ] **Step 5: Check #4 — releasing input collapses the trail quickly.**

Stop pressing movement keys. The trail should collapse from its current length toward the parked ship within roughly a quarter second.

Pass criterion: the trail visibly retracts and disappears within ~250 ms of stopping input.

If the trail lingers too long: `TRAIL_DECAY = 4` is too low. Try `6` or `8`. (Higher decay also requires bumping `TRAIL_LENGTH` proportionally if you want to preserve the steady-state length.)

If the trail collapses too quickly (snaps instead of fades): `TRAIL_DECAY` is too high. Try `3`.

- [ ] **Step 6: If `TAIL_OFFSET_Z` looks wrong, tune.**

If the visible trail origin emerges from inside the speeder or floats too far behind it: tune `TAIL_OFFSET_Z` in `Player.tsx`. Range to try: `0.2` (closer) to `0.8` (further). Re-run `pnpm dev` (vite HMR usually picks up the constant change without restart).

Do **not** restructure the anchor's parent group to "fix" the origin — the parent group placement is structurally required for yaw lerp to apply. The offset constant is the only knob.

- [ ] **Step 7: If any tuning was applied, re-run `pnpm check` and commit.**

```bash
pnpm check
```

Expected: all green.

```bash
git add src/features/scene/components/Scene/Player.tsx
git commit -m "fix(scene): tune trail constants after visual review

<one-sentence note about which constants moved and why>"
```

If no tuning was needed, skip this step — no second commit.

---

## Self-review

**1. Spec coverage:**

- Goal (cyan wake behind moving speeder) → Task 1, Steps 4–5.
- Non-goals (no bloom, no second trail, no FSM changes, no new tests) → Task 1 contains no edits to anything outside the two specified files; no FSM, no bloom passes, no new test cases.
- Architecture (single-file, anchor inside flip group, children-mode) → Task 1, Step 5 JSX matches the spec's JSX verbatim.
- Trail tuning constants table → Task 1, Step 4 lists all six with the spec's values.
- Library API conformance choices (children-mode; no local/stride/interval/material override/forwarded ref) → Task 1, Step 5 JSX uses only the props the spec lists; none of the declined-API props appear.
- Testing (no new tests, one mock patch) → Task 1, Step 2.
- Verification before declaring done (`pnpm check` + four visual checks) → Task 1, Steps 6–9 cover automated; Task 2 covers manual.

No gaps.

**2. Placeholder scan:**

- No "TBD", "TODO", "implement later", "fill in details" — verified.
- No "Similar to Task N" — Task 2's steps repeat the relevant tuning constants by name where needed.
- Steps with code changes contain the actual code, not descriptions.

**3. Type consistency:**

- `TRAIL_ATTENUATION` is `(t: number) => number` in Step 4 and used as `attenuation={TRAIL_ATTENUATION}` in Step 5 — matches `(width: number) => number` in drei's `TrailProps`. ✓
- No `useRef`, no `Group` import — children-mode means the anchor is a JSX element only; nothing to type. ✓
- The drei `Trail` import in Step 3 is consumed in Step 5 JSX. ✓

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-19-spaceship-trail.md`.** Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
