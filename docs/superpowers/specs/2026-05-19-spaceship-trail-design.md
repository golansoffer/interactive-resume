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

Player's return changes from a single root `<group>` to a fragment containing the existing rig **plus** a sibling `<Trail …/>`. The Trail must sit outside the transformed parent because `drei` renders it in canvas-root space — nesting it under the ship's `<group ref={meshRef}>` would compound the ship's transform on top of the Trail's own sampling math.

```tsx
return (
  <>
    <group ref={props.meshRef} scale={SHIP_SCALE} rotation={[0, 0, 0, 'YXZ']}>
      <group rotation={[0, Math.PI, 0]}>
        <Center>
          <primitive object={scene} />
        </Center>
        <group ref={tailRef} position={[0, 0, TAIL_OFFSET_Z]} />
      </group>
    </group>
    <Trail
      target={tailRef}
      width={TRAIL_WIDTH}
      length={TRAIL_LENGTH}
      color={TRAIL_COLOR}
      decay={TRAIL_DECAY}
      attenuation={TRAIL_ATTENUATION}
    />
  </>
);
```

### Why the anchor lives inside the flip group

The speeder model is mounted inside `<group rotation={[0, Math.PI, 0]}>` (the "flip group" that turns the imported model 180° so its nose faces the canonical forward). Placing the tail anchor inside this flip group means:

- Local +Z in the flip group = world-relative "behind the ship's tail" after all parent transforms are applied.
- The anchor inherits the ship's position **and** its yaw lerp automatically — when the ship banks into a turn, the trail follows the new heading without any extra rotation math in the trail wiring.
- One offset constant (`TAIL_OFFSET_Z`) suffices; no quaternion composition, no manual rotation of the offset by the ship's heading.

If the anchor were placed in the outer `<group ref={meshRef}>`, local +Z would point in the model-imported direction (the speeder's nose, before flip), and the trail would emerge from the front. Wrong layer.

### Refs

One new ref alongside the existing scratch refs in Player:

```ts
const tailRef = useRef<Group>(null);
```

The `Group` type is imported from `three`. The ref is read by `Trail` via its `target` prop; Player itself never reads or writes `tailRef.current`. No `useFrame` interaction with the anchor — its world position is derived purely from the React-rendered transform tree.

## Trail tuning constants

All added at file scope in `Player.tsx`, in the same style as the existing `MAX_PITCH`, `MAX_ROLL`, `HEADING_LERP` constants:

| Constant | Value | Rationale |
|---|---|---|
| `TAIL_OFFSET_Z` | `0.4` | Empirically the rear of the speeder model post `Center` + scale 0.6. Visual tweakability is a one-line change. |
| `TRAIL_WIDTH` | `0.18` | About ¼ of ship width. Focused streak, not a banner. |
| `TRAIL_LENGTH` | `0.6` | Seconds of history retained. At `MAX_SPEED = 14`, that's ~8.4 world units of trail at full speed — roughly 7× ship length. Long enough to read, short enough not to fill the view. |
| `TRAIL_COLOR` | `'#5fd6ff'` | Cyan engine glow on the `#04050a` space background. |
| `TRAIL_DECAY` | `4` | Higher than the drei default of `1`. Trail collapses quickly when the ship slows → engine reads as responsive, not languid. |
| `TRAIL_ATTENUATION` | `(t) => t * t` | Quadratic taper: full width at the engine end, sharp pinch to a point at the tail tip. Reads as an engine wake rather than a uniform-width line. |

## Data flow

There is no new data flow. The Trail is a write-only consumer of the rendered transform tree:

```
Player useFrame
  → mutates meshRef.current.position / .rotation
    → React-Three Fiber reconciles transforms down the tree
      → tailRef.current's world matrix updates
        → Trail samples tailRef.current.getWorldPosition() each frame
          → renders the streak in canvas-root space
```

No props, no events, no callbacks. The ship moves; the trail follows. The reducer never learns the trail exists.

## Iron Law compliance

- **Iron Law 1 (Hexagonal):** The trail is pure UI inside `components/Scene/`. It does not import from `api/`, `core/`, `routes/`, or any sibling component. It does not introduce a port. The renderer integrator stays untouched.
- **Iron Law 2 (Discriminated Unions):** No new types. No optional flags. No boolean toggles.
- **Iron Law 3 (Make Illegal States Unrepresentable):** No new states to model. The "moving / not moving" distinction is not represented at all — it's a continuous physical property handled by Trail's own sampling. There is nothing to gate, nothing to assert, nothing to default.
- **Iron Law 4 (Design Discipline):** One file, one ref, six constants, no helpers, no extracted component, no new props. The decoration sits with the thing it decorates. No "for now," no "stub," no `// TODO`.

No type-system suppressors. No `!`, no `as`, no `??` on lookups, no `eslint-disable`, no `any`. All new types are concrete (`Group` from `three`, the `Trail` props from `@react-three/drei`).

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
