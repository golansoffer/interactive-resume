# Spaceship Engine Trail — Design

**Date:** 2026-05-19
**Scope:** Add a `<Trail>` (from `@react-three/drei`) behind the speeder so it leaves a visible engine wake while moving.

---

## Goal

The player ship currently translates and rotates through space with no visual trace of motion. Add a single cyan engine-wake streak that emerges from the rear of the ship and naturally collapses when the ship is parked.

"When it's moving" is not gated by an explicit state check — `drei`'s `Trail` samples its target's world position over time. When the target stops moving, the tail catches up to the head and the trail collapses to a point (effectively invisible). The motion-conditional behavior falls out of the physics; no opacity lerp, no `integratesIn` branch, no new reducer events.

## Non-goals

- No postprocessing/bloom pass. The cyan-on-near-black contrast carries the look on its own.
- No second trail, no per-engine nozzle anchors. One central rear-of-ship trail.
- No new domain state, no new events, no FSM changes.
- No new tests beyond patching the existing drei mock so the smoke tests still pass.

## Architecture

### Layer placement

Single file touched: `src/features/scene/components/Scene/Player.tsx`.

The Trail is a pure visual decoration of one rig (the speeder). It lives in the same component as the rig it decorates. No new component, no `EngineTrail.tsx`, no shared ref via `useSceneRefs`. Extracting it would require Player to publish an internal anchor it has no other use for — indirection without earning its place (Iron Law 4).

No new props on `PlayerProps`. No changes to `Scene.tsx`, `useSceneRefs.ts`, or any other file.

### JSX shape change

Player's return keeps its single root `<group>` but adds `<Trail>` *inside* the flip group, wrapping the anchor as Trail's only child. drei's Trail walks its inner host group's children and uses the first `Object3D` it finds as the anchor (`Trail.js:97`), so the anchor `<group>` is mounted as a child of `<Trail>` directly — no `target` prop, no ref, no `useRef` for the anchor. drei internally `createPortal`s the line mesh into the canvas-root scene (`Trail.js:141`), so the rendered streak still draws in world space; only the anchor sampling needs to see the ship's transforms, which it does through React's normal parent chain.

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

Reading: "the engine wake is a decoration attached to a point at the rear of the speeder rig." Trail's outer + inner host groups have identity transforms (`Trail.js:141–147`), so the anchor's effective parent remains the flip group; ship motion and yaw lerp carry the anchor exactly as they would if the anchor were a direct child of the flip group.

### Why the anchor lives inside the flip group

The speeder model is mounted inside `<group rotation={[0, Math.PI, 0]}>` (the "flip group" that turns the imported model 180° so its nose faces the canonical forward). Mounting `<Trail>` inside this flip group — with the anchor `<group>` as Trail's child — means:

- Local +Z in the flip group = world-relative "behind the ship's tail" after all parent transforms are applied.
- The anchor inherits the ship's position **and** its yaw lerp automatically — when the ship banks into a turn, the trail follows the new heading without any extra rotation math.
- Trail's outer + inner host groups (`Trail.js:141–147`) sit between the flip group and the anchor, but both carry identity transform, so the anchor's effective parent chain is unchanged.
- One offset constant (`TAIL_OFFSET_Z`) suffices; no quaternion composition, no manual rotation by the ship's heading.

If `<Trail>` were mounted outside the flip group (e.g., as a sibling of the ship's root group), the anchor would still be Trail's child but would no longer inherit the flip + yaw transforms — the trail would emerge from world origin and never move with the ship. The placement inside the flip group is structurally required.

### No new refs

The `target` prop is not used. drei's children-as-target fallback (`Trail.js:97`) finds the anchor via `ref.current.children.find(o => o instanceof Object3D)` on Trail's internal host group. No `useRef`, no `Group` import, no manual ref plumbing. The anchor's world position flows through the React-rendered transform tree exactly as any other child of the flip group would.

## Trail tuning constants

All added at file scope in `Player.tsx`, in the same style as the existing `MAX_PITCH`, `MAX_ROLL`, `HEADING_LERP` constants.

**Important drei-API notes that drive the values:**

- `length` is **not** in seconds. drei allocates a position buffer of `length * 10` samples (`Trail.js:34`). At `decay = 4`, drei pushes 4 samples per frame (`Trail.js:52`). Effective trail duration at 60 fps = `(length * 10) / (decay * 60)`. To get ~0.6 s of memory at decay 4, length must be ~14.4.
- `width` is **internally multiplied by 0.1** when drei builds the MeshLineMaterial (`Trail.js:108`). With `sizeAttenuation = 1` (perspective-scaled world units), the prop value `1` corresponds to a `0.1` world-unit MeshLine. To get a streak ~0.2 world units wide (≈ ⅙ ship width), the prop value must be ~2.0.
- `attenuation`'s `t` is normalized position along the line: `t = 0` at the oldest sample (tail tip) and `t = 1` at the newest sample (engine end). `(t) => t * t` therefore pinches the tail and keeps the engine full-width — the engine-wake shape.

| Constant | Value | Rationale |
|---|---|---|
| `TAIL_OFFSET_Z` | `0.4` | Local +Z inside the flip group → the rear of the speeder model post `Center` + scale 0.6. Visually tunable in a one-line change. |
| `TRAIL_WIDTH` | `2.0` | drei applies `lineWidth = 0.1 * width`. `2.0 → 0.2` world-unit lineWidth ≈ ⅙ ship width. Focused streak, not a banner. |
| `TRAIL_LENGTH` | `15` | Buffer of `150` samples. At `decay = 4` and 60 fps, holds ~0.625 s of history. At `MAX_SPEED = 14`, that's ~8.7 world units of trail at full speed — roughly 7× ship length. |
| `TRAIL_COLOR` | `'#5fd6ff'` | Cyan engine glow on the `#04050a` space background. Passed as `ColorRepresentation` string (drei accepts hex strings, numbers, or `Color` instances). |
| `TRAIL_DECAY` | `4` | Samples-per-frame multiplier. Higher than the drei default of `1` so older samples are flushed faster — when the ship slows, the trail collapses snappily. Paired with the larger buffer (length 15) to keep the steady-state spatial extent the same. |
| `TRAIL_ATTENUATION` | `(t) => t * t` | Quadratic taper: tail tip pinches to zero width, engine end at full width. Reads as an engine wake rather than a uniform line. |

## Data flow

There is no new data flow. The Trail is a write-only consumer of the rendered transform tree:

```
Player useFrame
  → mutates meshRef.current.position / .rotation
    → React-Three Fiber reconciles transforms down the tree
      → the anchor <group> (Trail's child, inside the flip group) gets a fresh world matrix
        → drei's Trail samples anchor.getWorldPosition() each frame
          → drei portals the resulting line mesh into the canvas-root scene
```

The anchor is discovered once at mount: drei's `Trail` runs an effect that reads `ref.current.children.find(o => o instanceof Object3D)` on its internal host group (`Trail.js:96–103`) and stores the result. After that, every frame samples that anchor's world position. No props from Player, no events, no callbacks. The ship moves; the trail follows. The reducer never learns the trail exists.

## Iron Law compliance

- **Iron Law 1 (Hexagonal):** The trail is pure UI inside `components/Scene/`. It does not import from `api/`, `core/`, `routes/`, or any sibling component. It does not introduce a port. The renderer integrator stays untouched.
- **Iron Law 2 (Discriminated Unions):** No new types. No optional flags. No boolean toggles.
- **Iron Law 3 (Make Illegal States Unrepresentable):** No new states to model. The "moving / not moving" distinction is not represented at all — it's a continuous physical property handled by Trail's own sampling. There is nothing to gate, nothing to assert, nothing to default.
- **Iron Law 4 (Design Discipline):** One file, six constants, no new ref, no helpers, no extracted component, no new props. The decoration sits with the thing it decorates. No "for now," no "stub," no `// TODO`.

No type-system suppressors. No `!`, no `as`, no `??` on lookups, no `eslint-disable`, no `any`. No `Group` import is needed at all — the anchor `<group>` element is reconciled by R3F without us touching the underlying type.

## Library API conformance

This section records explicit choices about using `@react-three/drei`'s `Trail` the way the library intends — not how a copy-pasted online snippet might suggest. It also records the reason for choosing children-mode over the `target` prop, because the choice looks like it should go the other way until you check the installed type definitions.

- **Children-as-target, not the `target` prop.** drei supports two modes (`Trail.js:96–103`): pass `target={ref}` *or* mount the anchor `Object3D` as a child of `<Trail>` and let drei find it via `ref.current.children.find(o => o instanceof Object3D)`. We use the children mode. The seemingly obvious `target={ref}` path runs into a real incompatibility with the installed types: `useRef<Group>(null)` in `@types/react@19.2.14` (`index.d.ts:1749`) returns `RefObject<Group | null>` (the `T | null` overload preserves the null in the return type), while drei `10.7.7` requires `target?: React.RefObject<Object3D>` non-nullable (`Trail.d.ts:16`). Going from `RefObject<Group | null>` to `RefObject<Object3D>` requires either a cast (banned by Iron Law 3 / the project's suppressor scan), imperative `new Group()` construction with `<primitive>` (more code, more moving parts), or a drei upgrade (out of scope for one feature). Children-mode resolves the problem cleanly — no ref, no cast, no extra construction — and it is documented drei API, not a workaround. The mode is implemented in drei via the explicit `||` fallback at `Trail.js:97`, which means we are using the path drei wrote, not a side-door.
- **No `local` prop override.** drei's default is `local = false` → samples taken via `anchor.getWorldPosition()` (`Trail.js:49`). World-space sampling is what we want; the trail is a world-space wake. Setting `local = true` would sample `anchor.position` (a constant `[0, 0, 0.4]` in the flip group's local frame) — the trail would never move. Leaving it at the default is correct.
- **No `stride` or `interval` override.** Defaults (`stride = 0`, `interval = 1`) sample every frame regardless of distance moved. With our ship motion (continuous and smooth), neither knob earns its keep. They'd matter for very slow targets where you'd want to skip stationary samples — not us.
- **No `<meshLineMaterial>` children override.** drei supports overriding the default material via a child `<meshLineMaterial>` element (`Trail.js:116–131`). We pass the anchor `<group>` as the sole child instead, and use the top-level `color` prop for material color. drei's children-walking code finds the first `Object3D` (our anchor) and ignores any `meshLineMaterial` we'd add; mixing both modes works but is unnecessary here.
- **One forwarded `ref` opportunity declined.** drei exports `Trail` as a `ForwardRefComponent<…, MeshLineGeometry>` (`Trail.d.ts:20`) — you can grab the underlying `MeshLineGeometry` via `ref`. We don't need it; we don't mutate the geometry, we don't query it. Skipping it keeps the API surface in Player one prop narrower.

These choices are the path the drei API was designed around. No `@ts-ignore`, no `eslint-disable`, no `as`/`!`/`?? <default>` cast, no patches over a mismatch, no "stub for X". If a future drei release updates `Trail.d.ts` to type `target?: RefObject<Object3D | null>`, switching back to the `target`-prop mode would become trivial — but until then, children-mode is the cleanest match for the installed versions.

## Testing

**No new tests written.** A structural assertion on `Trail`'s props would test the implementation rather than the behavior. The existing smoke tests in `Scene.test.tsx` assert the scene renders in every `SceneState` variant; that contract remains the only behavior worth automating.

**One existing test must be patched.** `Scene.test.tsx` mocks `@react-three/drei` (lines 52–64 at the time of writing). The mock object must list `Trail` so render-without-throwing tests keep passing after Player imports it:

```ts
Trail: ({ children }: { readonly children?: ReactNode }): ReactNode => children ?? null,
```

This is a single new key in the existing mock — no new mock file, no new test case.

## Verification before declaring done

1. `pnpm check` — typecheck + oxlint + suppressor scan + vitest all pass.
2. `pnpm dev` and visually confirm in the browser:
   - **Parked ship:** no visible trail (tail collapsed to a point).
   - **Hold forward:** cyan streak emerges from the rear, ~7× ship length at full speed.
   - **Yaw turns:** trail follows the heading — this is *the* check that proves the anchor is inside the flip group. If the trail did not rotate with the ship, the anchor would be in the wrong layer.
   - **Release input:** trail collapses smoothly within a fraction of a second (validates `TRAIL_DECAY = 4`).

If `TAIL_OFFSET_Z = 0.4` looks wrong on screen (anchor poking through the nose, or floating too far behind), tune the constant — not the architecture.

## Out-of-scope follow-ups

These are explicitly NOT part of this change. Listed here so a future reader knows they were considered and deliberately skipped:

- Per-engine twin trails on the speeder's left/right nozzles.
- Speed-modulated color (warm at high speed, cool at low speed).
- Postprocessing / bloom for an emissive glow.
- A "boost" intent variant that thickens or brightens the trail.

Each of these would be a separate, justified design — not a quiet extension of this one.
