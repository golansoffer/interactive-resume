# Earth Moon — BDD Scenarios

**Date:** 2026-05-23
**Status:** Port-targeted Gherkin scenarios for the additive visual-only feature defined in [2026-05-23-earth-moon-design.md](./2026-05-23-earth-moon-design.md).
**Companion:** [2026-05-23-earth-moon-tdd.md](./2026-05-23-earth-moon-tdd.md)

---

## Reading rules

- Every scenario describes **observable behavior crossing a port**: parsed types in, parsed types or events out.
- No scenario references implementation tooling (renderer engine, hook names, refs, framework primitives, three.js classes). Implementation can swap without rewording.
- Ports under test:
  - **Config → render port:** `PlanetConfig.satellites: ReadonlyArray<SatelliteSpec>` flowing `companies.ts → Companies → Planet → Satellite`.
  - **Orbit math port:** `satelliteOffset(orbit: SatelliteOrbit, timeSeconds: number) → readonly [number, number, number]`. Pure, deterministic, no externalities.
  - **Body extraction port:** `usePlanetVisual(assetId, phase) → { plan, pose, extraction }`. Shared visual pipeline consumed by `Planet` and `Satellite`.
  - **Collider registry port:** the inbound port the proximity / collision systems read from (planets register, satellites do not).
  - **Activation port:** the inbound port that maps an in-range planet id to its reveal — driven only by registered planet centers, never by satellites.
- One scenario per behavior. Outlines parameterize keys / boundaries.
- "The viewer" is the player ship pilot. "The scene" is the rendered 3D world.

---

## User flow

The viewer flies the ship from the solar system overview toward the Earth planet (StreamElements / `earth_b`). As they approach, they see Earth at its placement point. A small body orbits Earth on a slightly tilted path, distinct from Earth itself, recognizably a satellite — closer to Earth than to anything else, smaller than Earth, in continuous steady motion. The viewer can fly the ship through the moon's path without being stopped. Approaching the moon does not trigger Earth's StreamElements reveal — only approaching Earth itself does.

---

## Feature: Satellite data flow from config to render

`PlanetConfig` carries a required `satellites: ReadonlyArray<SatelliteSpec>` field. The companies data table is the source of truth; `Companies` threads the array through to `Planet`; `Planet` mounts one `Satellite` child per spec. `FillerPlanets` passes an explicit empty array (Iron Law 3 — no optional).

### Scenario: every entry in the career-route companies table declares a satellites array
- **Given** the parsed companies table for `CAREER_ROUTE`
- **Then** every entry's `planet.satellites` field is present and is a `ReadonlyArray<SatelliteSpec>`
- **And** no entry's `planet.satellites` field is `undefined`

### Scenario: the StreamElements entry declares exactly one satellite, the Earth moon
- **Given** the parsed companies table for `CAREER_ROUTE`
- **When** the StreamElements entry's `planet.satellites` is inspected
- **Then** the array contains exactly one `SatelliteSpec`
- **And** that spec's `assetId` is `moon_a`
- **And** that spec's `id` is unique across the parsed table

### Scenario Outline: every non-Earth career-route entry declares zero satellites
- **Given** the parsed companies table for `CAREER_ROUTE`
- **When** the `<entry>` entry's `planet.satellites` is inspected
- **Then** the array length is `0`

| entry        |
| ------------ |
| `cisco`      |
| `hewlettpackard` |
| `intel`      |
| `vmware`     |

(Only StreamElements carries a moon per the design; every other entry is `satellites: []`. If the design changes, this outline is the place to update.)

### Scenario: Companies forwards each entry's satellites array to Planet
- **Given** the rendered `Companies` surface with the parsed `CAREER_ROUTE` table
- **When** the `Planet` rendered for the StreamElements entry is inspected
- **Then** its `satellites` prop is the same `ReadonlyArray<SatelliteSpec>` declared on that entry
- **And** when the `Planet` rendered for any other entry is inspected, its `satellites` prop is an empty array

### Scenario: FillerPlanets passes an explicit empty satellites array to Planet
- **Given** the rendered `FillerPlanets` surface with any filler entries
- **When** any `Planet` rendered by `FillerPlanets` is inspected
- **Then** its `satellites` prop is an empty array
- **And** the prop is supplied explicitly, not omitted

### Scenario: Planet mounts one Satellite child per spec in its satellites prop
- **Given** a `Planet` rendered with `satellites: [specA, specB, specC]` (three arbitrary specs)
- **Then** three `Satellite` children are mounted inside the placement group
- **And** each `Satellite` receives a distinct `spec` prop matching one entry from the array
- **And** the `Satellite` children are siblings of the planet's body group (they sit in the outer placement group, not under the body's sway transform)

### Scenario: Planet renders zero Satellite children when satellites is empty
- **Given** a `Planet` rendered with `satellites: []`
- **Then** no `Satellite` child is mounted
- **And** the body group is rendered exactly as if no `satellites` prop concept existed

### Scenario: Satellite receives spec end-to-end from the companies table
- **Given** the scene is rendered for the active career route
- **When** the satellite for the StreamElements entry is inspected
- **Then** its `spec.assetId` is `moon_a`
- **And** its `spec.scale` matches the value declared in `companies.ts`
- **And** its `spec.orbit` matches the orbit values declared in `companies.ts` field-for-field

---

## Feature: Pure orbit math — `satelliteOffset(orbit, timeSeconds)`

The orbit primitive is a pure function: `(orbit: SatelliteOrbit, timeSeconds: number) → readonly [number, number, number]`. No three.js, no React, no DOM. Deterministic — same inputs always yield the same offset. The orbit is a circle of radius `orbit.radius` in a plane tilted by `orbit.inclinationDeg` from the xz plane, swept at `2π / orbit.periodSeconds` radians per second, starting from `orbit.phase`.

### Scenario: at time zero with zero phase and zero inclination, the offset is on the +x axis at the orbit radius
- **Given** an orbit `{ radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 }`
- **When** `satelliteOffset(orbit, 0)` is evaluated
- **Then** the returned offset is `[5, 0, 0]` (within float tolerance)

### Scenario: at one quarter of the period with zero phase and zero inclination, the offset is on the +z axis at the orbit radius
- **Given** an orbit `{ radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 }`
- **When** `satelliteOffset(orbit, 2.5)` is evaluated
- **Then** the returned offset is `[0, 0, 5]` (within float tolerance)

### Scenario: at half of the period with zero phase and zero inclination, the offset is on the -x axis at the orbit radius
- **Given** an orbit `{ radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 }`
- **When** `satelliteOffset(orbit, 5)` is evaluated
- **Then** the returned offset is `[-5, 0, 0]` (within float tolerance)

### Scenario: at three quarters of the period with zero phase and zero inclination, the offset is on the -z axis at the orbit radius
- **Given** an orbit `{ radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 }`
- **When** `satelliteOffset(orbit, 7.5)` is evaluated
- **Then** the returned offset is `[0, 0, -5]` (within float tolerance)

### Scenario: at one full period, the offset returns to the time-zero value
- **Given** an orbit `{ radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 }`
- **When** `satelliteOffset(orbit, 10)` is evaluated
- **Then** the returned offset equals `satelliteOffset(orbit, 0)` (within float tolerance)

### Scenario: inclination tilts the orbit plane out of xz so y becomes non-zero
- **Given** an orbit `{ radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 30 }`
- **When** `satelliteOffset(orbit, 2.5)` is evaluated
- **Then** the returned `y` component is non-zero
- **And** the squared sum `x² + y² + z²` equals `25` (within float tolerance) — the body remains on the orbit sphere

### Scenario: 90-degree inclination sends the planar swing fully into y, collapsing z to zero
- **Given** an orbit `{ radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 90 }`
- **When** `satelliteOffset(orbit, 2.5)` is evaluated
- **Then** the returned offset is `[0, 5, 0]` (within float tolerance)

### Scenario: zero inclination keeps every offset in the xz plane
- **Given** an orbit `{ radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 }`
- **When** `satelliteOffset(orbit, t)` is evaluated for `t ∈ { 0, 1, 2.5, 5, 7.5, 9.999 }`
- **Then** the returned `y` component is `0` for every `t` (within float tolerance)

### Scenario: a non-zero phase shifts the starting angle along the orbit
- **Given** an orbit `{ radius: 5, periodSeconds: 10, phase: π, inclinationDeg: 0 }`
- **When** `satelliteOffset(orbit, 0)` is evaluated
- **Then** the returned offset equals `satelliteOffset({ radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 }, 5)` (within float tolerance)

### Scenario: angular frequency is the inverse of the period
- **Given** two orbits with `periodSeconds: 10` and `periodSeconds: 5`, identical otherwise
- **When** `satelliteOffset` is evaluated for each at `timeSeconds = 5`
- **Then** the offset for `periodSeconds: 10` equals the offset for `periodSeconds: 5` at `timeSeconds = 2.5` (within float tolerance) — half a period elapsed in each case

### Scenario: the function is deterministic — repeated calls with identical inputs return identical outputs
- **Given** an orbit `{ radius: 6, periodSeconds: 10, phase: 0.7, inclinationDeg: 15 }`
- **When** `satelliteOffset(orbit, 3.14)` is evaluated twice
- **Then** the two returned offsets are component-wise equal

### Scenario: the function is referentially transparent — no mutation, no shared state
- **Given** an orbit literal `{ radius: 6, periodSeconds: 10, phase: 0.7, inclinationDeg: 15 }`
- **When** `satelliteOffset(orbit, t)` is evaluated for several values of `t`
- **Then** the orbit literal is unchanged after every call
- **And** the returned offset is a fresh value, not a shared singleton

---

## Feature: Moon is visual-only — no collider, no proximity contribution

The moon exists in the scene as a rendered body. It does not register with the collider system that stops the ship. It does not register with the proximity activation system that opens the StreamElements reveal. Both of these are observable through the registry / activation ports — not through inspecting `Satellite`'s internals.

### Scenario: flying the ship into the moon's orbit path does not stop the ship
- **Given** the scene is rendered with Earth and its moon at any moment in the moon's orbit
- **When** the ship trajectory crosses the moon's current position
- **Then** the ship's position continues past the moon along its trajectory
- **And** no collision event is emitted for the moon

### Scenario: the moon does not register a collider
- **Given** the scene is rendered with Earth (`earth_b`) and one satellite (`moon_a`) declared in the companies table
- **When** the collider registry is inspected
- **Then** exactly one collider entry is present for the Earth body group
- **And** no collider entry references the moon's group or mesh

### Scenario: the moon does not register a planet radius for proximity activation
- **Given** the scene is rendered with Earth and its moon
- **When** the planet-radius registry consulted by the activation port is inspected
- **Then** exactly one radius entry is registered for the Earth body
- **And** no radius entry is registered for the moon

### Scenario: approaching only the moon does not trigger Earth's reveal
- **Given** the scene is rendered with Earth at its placement point and the moon at some position on its orbit
- **And** the ship is positioned within the activation radius of the moon
- **And** the ship is outside the activation radius of Earth itself
- **When** the activation port is evaluated
- **Then** the StreamElements entry is not marked as in-range
- **And** no reveal event is emitted for the StreamElements entry

### Scenario: approaching Earth triggers the reveal regardless of the moon's current position
- **Given** the scene is rendered with Earth at its placement point
- **And** the ship is within the activation radius of Earth itself
- **When** the activation port is evaluated for `timeSeconds = 0`, `timeSeconds = 2.5`, `timeSeconds = 5`, `timeSeconds = 7.5` (sampling the full orbit period)
- **Then** the StreamElements entry is marked as in-range at every sampled time
- **And** the reveal is unaffected by the moon's varying position

### Scenario: the moon does not contribute a label
- **Given** the scene is rendered with Earth and its moon
- **When** the planet-label overlay is inspected
- **Then** exactly one label is registered for the Earth body
- **And** no label is registered for the moon

---

## Feature: Planets with no satellites render exactly as before (no regression)

A planet whose `satellites` prop is `[]` is observably indistinguishable from a planet rendered before the satellites prop existed. No additional groups are mounted; the body group is rendered identically; the collider and activation contributions are unchanged.

### Scenario: a planet with an empty satellites array mounts no additional groups
- **Given** a `Planet` rendered with the same `assetId` and `placement` as before the satellites feature
- **And** `satellites: []`
- **Then** the placement group contains exactly one body group child
- **And** no `Satellite` child is present

### Scenario: a planet with an empty satellites array registers the same collider as before
- **Given** a `Planet` rendered with `satellites: []` for a given `assetId`
- **And** the same `Planet` re-rendered as a baseline without the satellites feature concept
- **When** the collider registry is inspected for both renders
- **Then** the registered collider entries are equal in count, position, and radius

### Scenario: a planet with an empty satellites array contributes the same activation radius as before
- **Given** a `Planet` rendered with `satellites: []` for a given `assetId`
- **When** the planet-radius registry is inspected
- **Then** the radius entry for that planet matches the value extracted from the same GLB body before the satellites feature existed

### Scenario Outline: each non-Earth career-route planet renders with the same visible body it had before the satellites feature
- **Given** the scene is rendered for the active career route
- **When** the body group for the `<entry>` planet is inspected
- **Then** its mounted GLB primitive, scale, pose orientation, and placement match the values produced for `<entry>` before the satellites feature existed

| entry            |
| ---------------- |
| `cisco`          |
| `hewlettpackard` |
| `intel`          |
| `vmware`         |

---

## Feature: Planet refactored to consume `usePlanetVisual` still renders the same body

The `Planet` body-rendering pipeline (GLB load → cloned-and-dressed scene → visual plan → pose → body extraction) is extracted into the `usePlanetVisual(assetId, phase)` hook so `Satellite` can reuse it. After refactor, `Planet`'s observable output for the same `assetId` and `phase` is unchanged.

### Scenario Outline: `Planet` produces the same body mesh, pose, and radius as before the `usePlanetVisual` extraction
- **Given** a `Planet` rendered with `assetId = <assetId>` and a stable `placement`
- **When** the rendered body group, the pose alignment quaternion, and the extracted body radius are inspected
- **Then** the body group mounts the same GLB primitive as before the refactor
- **And** the pose alignment quaternion equals the value produced before the refactor (component-wise, within float tolerance)
- **And** the extracted body radius equals the value produced before the refactor (within float tolerance)

| assetId       |
| ------------- |
| `earth_b`     |
| `mars_b`      |
| `jupiter_b`   |
| `saturn_b`    |
| `uranus_a`    |
| `neptune_b`   |
| `venus_a`     |
| `mercury_a`   |

### Scenario: `Planet`'s registered collider is unchanged across the refactor
- **Given** a `Planet` rendered with `assetId = earth_b` and a stable `placement`
- **When** the collider registry entry for this planet is inspected
- **Then** its position equals the value registered before the refactor (component-wise)
- **And** its radius equals the value registered before the refactor (within float tolerance)

### Scenario: `Planet`'s registered activation radius is unchanged across the refactor
- **Given** a `Planet` rendered with `assetId = earth_b` and a stable `placement`
- **When** the planet-radius registry entry for this planet is inspected
- **Then** the registered radius equals the value registered before the refactor (within float tolerance)

### Scenario: `Planet`'s body sway, breath, and pulse behavior across frames is unchanged across the refactor
- **Given** a `Planet` rendered with `assetId = jupiter_b` (an entry with effect-driven look)
- **When** the body group's transform values are sampled across a sequence of render frames at the same elapsed-time stamps as a pre-refactor baseline
- **Then** the sampled transform values match the pre-refactor baseline (within float tolerance) at every sampled frame

---

## Feature: Satellite renders the spec's body at the right scale, animated by the orbit port

The `Satellite` component is a thin React adapter over the orbit port and `usePlanetVisual`. Its observable contract: mount the GLB body for `spec.assetId`, render it at `spec.scale * PLANET_BASE_SCALE`, and re-position its outer group each render frame to `satelliteOffset(spec.orbit, elapsedTime)`. It registers no collider, no activation radius, no label.

### Scenario: `Satellite` mounts the GLB body for `spec.assetId`
- **Given** a `Satellite` rendered with `spec.assetId = moon_a`
- **Then** the mounted GLB primitive is the body resolved by `usePlanetVisual('moon_a', spec-derived phase)`

### Scenario: `Satellite` applies `spec.scale * PLANET_BASE_SCALE` to its body group
- **Given** a `Satellite` rendered with `spec.scale = 0.3`
- **Then** the body group's scale is `0.3 * PLANET_BASE_SCALE` (uniform across x, y, z)

### Scenario: `Satellite`'s outer group is positioned via the orbit port each frame
- **Given** a `Satellite` rendered with `spec.orbit = { radius: 6, periodSeconds: 10, phase: 0, inclinationDeg: 15 }`
- **When** the render loop advances elapsed time from `0` to `2.5` seconds across successive frames
- **Then** the outer group's position at each frame equals `satelliteOffset(spec.orbit, elapsedTime)` (component-wise, within float tolerance)

### Scenario: `Satellite` does not register a collider
- **Given** a `Satellite` rendered with any valid spec
- **When** the collider registry is inspected
- **Then** no collider entry references this `Satellite`'s group or mesh

### Scenario: `Satellite` does not register a planet radius
- **Given** a `Satellite` rendered with any valid spec
- **When** the planet-radius registry is inspected
- **Then** no radius entry references this `Satellite`

### Scenario: `Satellite` does not register a label
- **Given** a `Satellite` rendered with any valid spec
- **When** the planet-label overlay is inspected
- **Then** no label entry references this `Satellite`
