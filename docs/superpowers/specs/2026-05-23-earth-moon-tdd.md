# Earth Moon — TDD Test Bullets

**Date:** 2026-05-23
**Status:** Test bullets for the additive visual-only feature defined in [2026-05-23-earth-moon-design.md](./2026-05-23-earth-moon-design.md).
**Companion:** [2026-05-23-earth-moon-bdd.md](./2026-05-23-earth-moon-bdd.md)

---

## Reading rules

- Each bullet is one `it(...)` description — plain English, action-verb led (`returns`, `applies`, `mounts`, `forwards`, `registers`, `omits`, `equals`, `preserves`, `produces`).
- Bullets describe **observable output crossing the port under test**. No bullet names a hook implementation, a ref, a renderer engine, a framework primitive, or a three.js class.
- Each file's tests target one port and one port only — they never reach across into a sibling sub-layer:
  - `satelliteOffset.test.ts` tests the pure orbit math port (numbers in, numbers out). No React, no three.js.
  - `usePlanetVisual.test.ts` tests the shared visual-plan hook's returned bundle. No assertions on internal data-loader behavior, no JSX inspection.
  - `Satellite.test.tsx` tests the satellite component's props-in / scene-graph-out contract and its registry abstinence. No reaching into `usePlanetVisual` internals.
  - `Planet.test.tsx` (extended) tests `Planet`'s props-in / scene-graph-out contract and its registry contributions. Refactor regression is asserted against the same observable outputs as before.
  - `Companies.test.tsx` (new) and `FillerPlanets.test.tsx` (new) test the prop-threading port between the data table / filler factory and the rendered `Planet`s.
- The bullet count per file is documented inline so future agents can verify nothing leaked or accumulated.

---

## File: `src/features/scene/services/renderer/satelliteOffset.test.ts`

Targets the **pure orbit math port**: `satelliteOffset(orbit: SatelliteOrbit, timeSeconds: number) → readonly [number, number, number]`. Plain-record / number-array signature only. No three.js, no React, no DOM.

- [ ] returns `[0, 0, radius]` for time zero with zero phase and zero inclination (moon starts behind the planet on the +Z depth axis)
- [ ] returns `[radius, 0, 0]` for one quarter of the period with zero phase and zero inclination (moon swings sideways into +X)
- [ ] returns `[0, 0, -radius]` for half of the period with zero phase and zero inclination (moon is in front of the planet on the -Z depth axis)
- [ ] returns `[-radius, 0, 0]` for three quarters of the period with zero phase and zero inclination (moon swings sideways into -X)
- [ ] returns the same offset at one full period as at time zero (orbit closes)
- [ ] keeps the `y` component at zero for every sampled time when `inclinationDeg` is zero
- [ ] returns `[0, radius, 0]` at one quarter of the period when `inclinationDeg` is 90 (planar swing collapses fully into `y`, `x` collapses to zero)
- [ ] returns `[0, ±radius, 0]` across the full quarter / three-quarter sweep when `inclinationDeg` is 90 (orbit lies in the YZ plane; `x` stays zero for every sampled time)
- [ ] produces a non-zero `y` at one quarter of the period when `inclinationDeg` is 30
- [ ] keeps `x² + y² + z²` equal to `radius²` at every sampled time across non-zero inclination (offset stays on the orbit sphere)
- [ ] returns the same offset for `(phase: π, timeSeconds: 0)` as for `(phase: 0, timeSeconds: periodSeconds / 2)` (phase shifts the starting angle)
- [ ] returns the same offset for `(phase: 2π, timeSeconds: 0)` as for `(phase: 0, timeSeconds: 0)` (phase is mod 2π)
- [ ] returns the offset at `(periodSeconds: 5, timeSeconds: 2.5)` equal to the offset at `(periodSeconds: 10, timeSeconds: 5)` for otherwise-equal orbits (angular frequency is the inverse of the period)
- [ ] returns the same offset across two successive calls with identical inputs (deterministic)
- [ ] leaves the input orbit object unchanged after the call (no mutation of `radius`, `periodSeconds`, `phase`, `inclinationDeg`)
- [ ] returns a fresh tuple instance on each call (no shared / cached singleton)
- [ ] returns finite numeric components for every sampled `(orbit, timeSeconds)` pair across the test matrix (no NaN, no Infinity)

Count: 17 bullets.

---

## File: `src/features/scene/components/Scene/usePlanetVisual.test.ts`

Targets the **shared visual-plan hook port**: `usePlanetVisual(assetId: PlanetAssetId, phase: number) → { plan, pose, extraction }`. Tests assert the shape and stability of the returned bundle. No assertions on JSX, no reach into private loader plumbing.

- [ ] returns a `plan` whose scene root is a non-null group containing the GLB mesh primitives for the requested asset
- [ ] returns a `pose` whose `alignQuaternion` is a finite four-component quaternion
- [ ] returns an `extraction` whose `kind` matches the body shape implied by the asset (`body` for spherical assets, `ringed_body` for ringed assets, `no_body` for an asset whose GLB has no mesh)
- [ ] returns an `extraction.radius` greater than zero for any non-`no_body` extraction
- [ ] returns the same `plan` reference across re-renders when `assetId` and `phase` are unchanged (memoized)
- [ ] returns the same `pose` reference across re-renders when `assetId` and `phase` are unchanged (memoized)
- [ ] returns the same `extraction` reference across re-renders when `assetId` and `phase` are unchanged (memoized)
- [ ] returns a new `plan` reference when `assetId` changes between renders
- [ ] returns a new `plan` reference when `phase` changes between renders (phase drives per-instance dressing)
- [ ] returns identical `plan`, `pose`, and `extraction` values (deep equal, not just reference equal) for two independent components called with the same `(assetId, phase)` pair

Count: 10 bullets.

---

## File: `src/features/scene/components/Scene/Satellite.test.tsx`

Targets the **satellite component port**: `Satellite({ spec: SatelliteSpec })` produces a positioned, scaled body group and registers nothing with the collider / activation / label registries. Tests assert observable scene-graph output and registry abstinence — not the internal calls used to produce them.

- [ ] mounts the GLB primitive for `spec.assetId` inside its body group
- [ ] applies a uniform scale equal to `spec.scale * PLANET_BASE_SCALE` to the body group along x, y, and z
- [ ] positions its outer group at `satelliteOffset(spec.orbit, 0)` on the first render frame
- [ ] re-positions its outer group at `satelliteOffset(spec.orbit, elapsedTime)` on every subsequent render frame, sampled at several elapsed times across one orbit period
- [ ] re-positions its outer group identically across re-renders when `spec.orbit` is unchanged and the same elapsed times are sampled (deterministic, port-driven)
- [ ] re-positions its outer group to the new orbit's values when `spec.orbit.radius` changes between renders
- [ ] re-positions its outer group to the new orbit's values when `spec.orbit.periodSeconds` changes between renders
- [ ] re-positions its outer group to the new orbit's values when `spec.orbit.phase` changes between renders
- [ ] re-positions its outer group to the new orbit's values when `spec.orbit.inclinationDeg` changes between renders
- [ ] registers no entry with the collider registry across mount and across subsequent render frames
- [ ] registers no entry with the planet-radius registry across mount and across subsequent render frames
- [ ] registers no entry with the planet-label overlay across mount and across subsequent render frames
- [ ] places the body group as a descendant of the outer group (so orbit translation moves the whole body)
- [ ] mounts the same GLB primitive that `usePlanetVisual(spec.assetId, ...)` would yield for the same asset (parity with the shared visual hook's observable output)
- [ ] unmounts cleanly without leaking collider, radius, or label registry entries

Count: 15 bullets.

---

## File: `src/features/scene/components/Scene/Planet.test.tsx` (extended)

Targets the **planet component port** — both its existing body-rendering contract (kept stable across the `usePlanetVisual` refactor) and its new `satellites` prop. Existing assertions in `Planet.test.tsx` (look resolution, body extraction) remain. New bullets below.

### Refactor regression — same observable output after consuming `usePlanetVisual`

- [ ] mounts the same GLB primitive in its body group for each supported `assetId` as before the `usePlanetVisual` refactor
- [ ] applies the same body-group scale (component-wise) for each supported `assetId` as before the refactor
- [ ] applies the same pose alignment quaternion (component-wise, within float tolerance) for each supported `assetId` as before the refactor
- [ ] registers the same collider position and radius for each supported `assetId` as before the refactor
- [ ] registers the same planet activation radius for each supported `assetId` as before the refactor
- [ ] samples the same body-group transform values across the same elapsed-time stamps as before the refactor, for an effect-driven entry (`jupiter_b`) — sway, breath, and pulse animation behavior is unchanged

### Satellites prop — threading and rendering

- [ ] mounts zero satellite children inside the placement group when `satellites` is an empty array
- [ ] mounts exactly `satellites.length` satellite children inside the placement group when `satellites` has length 1, 2, and 3
- [ ] passes each `SatelliteSpec` from the `satellites` array to a distinct satellite child as its `spec` prop, in array order
- [ ] places satellite children as direct children of the outer placement group, as siblings of the body group (so the body's sway transform does not drag satellites)
- [ ] registers exactly one collider entry (for the planet body) regardless of `satellites` length — satellites contribute no colliders
- [ ] registers exactly one planet-radius entry (for the planet body) regardless of `satellites` length — satellites contribute no activation radius
- [ ] registers exactly one planet-label entry (for the planet body) regardless of `satellites` length — satellites contribute no labels
- [ ] mounts identical body-group output when `satellites` is `[]` as when `satellites` is `[oneSpec]` (the satellite addition does not perturb the body)
- [ ] unmounts cleanly with no satellite-related registry leftovers when `satellites` is non-empty

Count: 15 new bullets (in addition to existing `Planet.test.tsx` content).

---

## File: `src/features/scene/components/Scene/Companies.test.tsx` (new)

Targets the **companies surface prop-threading port**: the parsed `CAREER_ROUTE` table flows into `Companies`, which renders one `Planet` per entry and forwards each entry's `planet.satellites` array verbatim. Tests assert that the satellites prop reaching each `Planet` matches the entry's declared value.

- [ ] renders one `Planet` for each entry in the `CAREER_ROUTE` companies table
- [ ] forwards `satellites: []` to the `Planet` for every non-StreamElements entry in `CAREER_ROUTE`
- [ ] forwards a one-element `satellites` array to the `Planet` for the StreamElements entry (`earth_b`)
- [ ] forwards a `satellites` array whose single element has `assetId = moon_a` for the StreamElements entry
- [ ] forwards the same `satellites` array reference declared on the entry to its `Planet` (no copy, no transform)
- [ ] forwards each entry's `planet.assetId` and `planet.placement` alongside `satellites` (props are threaded as a coherent triple)
- [ ] omits no entry — the count of rendered `Planet`s equals the count of entries in `CAREER_ROUTE`

Count: 7 bullets.

---

## File: `src/features/scene/components/Scene/FillerPlanets.test.tsx` (new)

Targets the **filler-planets surface prop-threading port**: `FillerPlanets` renders one `Planet` per filler entry and forwards an explicit empty `satellites` array (per Iron Law 3 — no optional prop, no implicit default). Tests assert observable explicit-empty threading.

- [ ] renders one `Planet` for each declared filler entry
- [ ] forwards `satellites: []` to every rendered filler `Planet`
- [ ] forwards `satellites` as a present prop (not omitted) on every rendered filler `Planet`
- [ ] forwards an empty array whose length is exactly zero for every rendered filler `Planet`
- [ ] forwards each filler's `assetId` and `placement` alongside the empty `satellites` array (props are threaded as a coherent triple)

Count: 5 bullets.

---

## Cross-file invariants verified by the suite as a whole

These behaviors are asserted in one of the per-file suites above; the cross-file table below records which suite owns each invariant so future agents do not duplicate assertions across files.

- **Orbit math determinism** — owned by `satelliteOffset.test.ts`.
- **Orbit math purity** (no mutation, no NaN) — owned by `satelliteOffset.test.ts`.
- **Visual hook memoization** — owned by `usePlanetVisual.test.ts`.
- **Satellite scale and orbit-driven positioning** — owned by `Satellite.test.tsx`.
- **Satellite registry abstinence** (no collider, no radius, no label) — owned by `Satellite.test.tsx`.
- **Planet refactor regression** (same body, pose, collider, radius, animation) — owned by `Planet.test.tsx`.
- **Planet → Satellite child count and sibling placement** — owned by `Planet.test.tsx`.
- **Planet registry contribution is unchanged by satellites length** — owned by `Planet.test.tsx`.
- **Companies threads satellites verbatim from the data table** — owned by `Companies.test.tsx`.
- **FillerPlanets passes an explicit empty satellites array** — owned by `FillerPlanets.test.tsx`.
