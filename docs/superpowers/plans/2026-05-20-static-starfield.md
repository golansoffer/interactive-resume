# Static Starfield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a camera-anchored, deterministic, single-draw-call starfield as the far-distance background of the 3D scene. Most stars are static; ~12% subtly pulse via a single GPU `uTime` uniform.

**Architecture:** Two pure modules in `src/features/scene/services/renderer/` (a seeded spec builder returning Float32Arrays, and a `ShaderMaterial` factory), one thin React/three-fiber adapter in `src/features/scene/components/Scene/Starfield.tsx`, and a single-line edit to `Scene.tsx` to mount it as the first child. No domain state, no events, no ports. Pure background chrome.

**Tech Stack:** TypeScript (strict), React 19, `@react-three/fiber` 9, `three` 0.184, vitest, oxlint.

**Spec reference:** `docs/superpowers/specs/2026-05-20-static-starfield-design.md`

---

## File Structure

| File | Purpose |
|---|---|
| `src/features/scene/services/renderer/starfieldSpec.ts` | Pure: seeded RNG + buffer construction. Exports `buildStarfieldSpec`, `StarfieldSpec`, `StarfieldSpecParams`. |
| `src/features/scene/services/renderer/starfieldSpec.test.ts` | Unit tests: determinism, counts, distribution ranges. |
| `src/features/scene/services/renderer/starfieldMaterial.ts` | Pure: `ShaderMaterial` factory. Exports `buildStarfieldMaterial`, `StarfieldMaterialParams`. Vertex + fragment GLSL inline. |
| `src/features/scene/services/renderer/starfieldMaterial.test.ts` | Unit tests: instance type, uniforms shape, material flags. |
| `src/features/scene/components/Scene/Starfield.tsx` | R3F adapter: builds spec + material via `useMemo`, renders `<points>`, syncs group position to camera each frame, ticks `uTime`. |
| `src/features/scene/components/Scene/Scene.tsx` | EDIT: import `Starfield`, render as first child inside the fragment. |
| `src/features/scene/components/Scene/Scene.test.tsx` | POSSIBLE EDIT: extend `vi.mock('@react-three/fiber')` to expose `camera.position.copy` if the existing render-tree blows up. (Verify first; only patch if needed.) |

---

## Conventions to follow (project-specific)

- **Strict TS:** `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `exactOptionalPropertyTypes`. Access uniforms via bracket syntax: `material.uniforms['uTime']`. Never `material.uniforms.uTime`.
- **No suppressors:** no `!`, no `as` (except at parse boundaries), no `@ts-ignore`, no `eslint-disable`. The codebase enforces this via `pnpm lint:suppressors`.
- **Discriminated unions:** every domain type has a `readonly kind` discriminator. The spec output type uses `kind: 'starfield_spec'`.
- **Functional, pure, immutable in core/services.** Mutation lives only in the R3F adapter (`useFrame` callback).
- **Tests use vitest** (`describe`, `it`, `expect`) and follow the per-file colocation pattern (`foo.ts` + `foo.test.ts`).
- **Module style:** named exports only; `import type` for type-only imports (`verbatimModuleSyntax`).
- **Imports inside `services/renderer/`:** allowed to import from `three`. No React, no fiber, no drei.

---

## Task 1: Pure spec — types and PRNG, failing test

**Files:**
- Create: `src/features/scene/services/renderer/starfieldSpec.ts`
- Create: `src/features/scene/services/renderer/starfieldSpec.test.ts`

- [ ] **Step 1: Create the empty module skeleton**

Create `src/features/scene/services/renderer/starfieldSpec.ts`:

```ts
export const STAR_SEED = 0xc0ffee;
export const STAR_COUNT = 1500;
export const STAR_RADIUS = 400;

export const STAR_SIZE_MIN = 0.6;
export const STAR_SIZE_MAX = 2.4;

export const STAR_BRIGHTNESS_MIN = 0.35;
export const STAR_BRIGHTNESS_MAX = 1;

export const TWINKLE_FRACTION = 0.12;
export const TWINKLE_AMP_MIN = 0.15;
export const TWINKLE_AMP_MAX = 0.35;

export type StarfieldSpecParams = {
  readonly seed: number;
  readonly count: number;
  readonly radius: number;
};

export type StarfieldSpec = {
  readonly kind: 'starfield_spec';
  readonly count: number;
  readonly positions: Float32Array;
  readonly sizes: Float32Array;
  readonly brightness: Float32Array;
  readonly twinkleAmps: Float32Array;
  readonly twinklePhases: Float32Array;
};

export const buildStarfieldSpec = (params: StarfieldSpecParams): StarfieldSpec => {
  throw new Error('not implemented');
};
```

- [ ] **Step 2: Write the determinism test**

Create `src/features/scene/services/renderer/starfieldSpec.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  STAR_BRIGHTNESS_MAX,
  STAR_BRIGHTNESS_MIN,
  STAR_COUNT,
  STAR_RADIUS,
  STAR_SEED,
  STAR_SIZE_MAX,
  STAR_SIZE_MIN,
  TWINKLE_AMP_MAX,
  TWINKLE_AMP_MIN,
  TWINKLE_FRACTION,
  buildStarfieldSpec,
} from './starfieldSpec';

const arraysEqual = (a: Float32Array, b: Float32Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

describe('buildStarfieldSpec — determinism', () => {
  it('returns identical arrays across two calls with the same seed', () => {
    const a = buildStarfieldSpec({ seed: 1, count: 100, radius: 10 });
    const b = buildStarfieldSpec({ seed: 1, count: 100, radius: 10 });
    expect(arraysEqual(a.positions, b.positions)).toBe(true);
    expect(arraysEqual(a.sizes, b.sizes)).toBe(true);
    expect(arraysEqual(a.brightness, b.brightness)).toBe(true);
    expect(arraysEqual(a.twinkleAmps, b.twinkleAmps)).toBe(true);
    expect(arraysEqual(a.twinklePhases, b.twinklePhases)).toBe(true);
  });

  it('returns different arrays for different seeds', () => {
    const a = buildStarfieldSpec({ seed: 1, count: 100, radius: 10 });
    const b = buildStarfieldSpec({ seed: 2, count: 100, radius: 10 });
    expect(arraysEqual(a.positions, b.positions)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test, confirm it fails**

Run: `pnpm test src/features/scene/services/renderer/starfieldSpec.test.ts`

Expected: FAIL with `Error: not implemented`.

- [ ] **Step 4: Commit the skeleton + failing test**

```bash
git add src/features/scene/services/renderer/starfieldSpec.ts \
        src/features/scene/services/renderer/starfieldSpec.test.ts
git commit -m "test(scene): add failing determinism test for starfield spec"
```

---

## Task 2: Implement spec builder with Mulberry32 PRNG

**Files:**
- Modify: `src/features/scene/services/renderer/starfieldSpec.ts`

- [ ] **Step 1: Implement the spec builder**

Replace the entire body of `src/features/scene/services/renderer/starfieldSpec.ts` with:

```ts
export const STAR_SEED = 0xc0ffee;
export const STAR_COUNT = 1500;
export const STAR_RADIUS = 400;

export const STAR_SIZE_MIN = 0.6;
export const STAR_SIZE_MAX = 2.4;

export const STAR_BRIGHTNESS_MIN = 0.35;
export const STAR_BRIGHTNESS_MAX = 1;

export const TWINKLE_FRACTION = 0.12;
export const TWINKLE_AMP_MIN = 0.15;
export const TWINKLE_AMP_MAX = 0.35;

export type StarfieldSpecParams = {
  readonly seed: number;
  readonly count: number;
  readonly radius: number;
};

export type StarfieldSpec = {
  readonly kind: 'starfield_spec';
  readonly count: number;
  readonly positions: Float32Array;
  readonly sizes: Float32Array;
  readonly brightness: Float32Array;
  readonly twinkleAmps: Float32Array;
  readonly twinklePhases: Float32Array;
};

type Rng = () => number;

const mulberry32 = (seed: number): Rng => {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const TWO_PI = Math.PI * 2;

export const buildStarfieldSpec = (params: StarfieldSpecParams): StarfieldSpec => {
  const { seed, count, radius } = params;
  const rng = mulberry32(seed);

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  const twinkleAmps = new Float32Array(count);
  const twinklePhases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const u1 = rng();
    const u2 = rng();
    const theta = TWO_PI * u1;
    const phi = Math.acos(1 - 2 * u2);
    const sinPhi = Math.sin(phi);
    positions[i * 3 + 0] = radius * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);

    const sizeT = rng();
    const sizeShaped = sizeT * sizeT * sizeT;
    const size = lerp(STAR_SIZE_MIN, STAR_SIZE_MAX, sizeShaped);
    sizes[i] = size;

    const sizeNorm = (size - STAR_SIZE_MIN) / (STAR_SIZE_MAX - STAR_SIZE_MIN);
    brightness[i] = lerp(STAR_BRIGHTNESS_MIN, STAR_BRIGHTNESS_MAX, sizeNorm);

    const isTwinkler = rng() < TWINKLE_FRACTION;
    if (isTwinkler) {
      twinkleAmps[i] = lerp(TWINKLE_AMP_MIN, TWINKLE_AMP_MAX, rng());
      twinklePhases[i] = rng() * TWO_PI;
      continue;
    }
    twinkleAmps[i] = 0;
    twinklePhases[i] = 0;
  }

  return {
    kind: 'starfield_spec',
    count,
    positions,
    sizes,
    brightness,
    twinkleAmps,
    twinklePhases,
  };
};
```

Notes:
- Mulberry32 is a 32-bit single-state PRNG. Fast, no allocations, deterministic.
- `acos(1 - 2u)` gives uniform-on-sphere `phi` (avoids equatorial bias of naive `π·u`).
- `sizeShaped = u³` pushes mass toward the small end (cubic distribution).
- Brightness is correlated with size, not independently drawn.
- Twinkle assignment is a Bernoulli trial per star — the `continue` branch keeps the non-twinkler default (`0`, `0`) tidy.

- [ ] **Step 2: Run determinism tests, confirm pass**

Run: `pnpm test src/features/scene/services/renderer/starfieldSpec.test.ts`

Expected: 2 passing tests.

- [ ] **Step 3: Commit the implementation**

```bash
git add src/features/scene/services/renderer/starfieldSpec.ts
git commit -m "feat(scene): implement deterministic starfield spec builder"
```

---

## Task 3: Distribution tests — counts, ranges, positions, twinkle ratio

**Files:**
- Modify: `src/features/scene/services/renderer/starfieldSpec.test.ts`

- [ ] **Step 1: Add distribution tests**

Append the following `describe` blocks to `starfieldSpec.test.ts` (after the existing `describe('buildStarfieldSpec — determinism', …)`):

```ts
describe('buildStarfieldSpec — counts', () => {
  it('produces arrays sized to the requested count', () => {
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS });
    expect(spec.count).toBe(STAR_COUNT);
    expect(spec.positions.length).toBe(STAR_COUNT * 3);
    expect(spec.sizes.length).toBe(STAR_COUNT);
    expect(spec.brightness.length).toBe(STAR_COUNT);
    expect(spec.twinkleAmps.length).toBe(STAR_COUNT);
    expect(spec.twinklePhases.length).toBe(STAR_COUNT);
  });

  it('tags the result with the starfield_spec kind', () => {
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: 10, radius: 1 });
    expect(spec.kind).toBe('starfield_spec');
  });
});

describe('buildStarfieldSpec — positions on the sphere', () => {
  it('places every star at the requested radius (within float tolerance)', () => {
    const radius = 400;
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: 500, radius });
    for (let i = 0; i < spec.count; i++) {
      const x = spec.positions[i * 3 + 0] ?? 0;
      const y = spec.positions[i * 3 + 1] ?? 0;
      const z = spec.positions[i * 3 + 2] ?? 0;
      const r = Math.hypot(x, y, z);
      expect(Math.abs(r - radius)).toBeLessThan(1e-3);
    }
  });
});

describe('buildStarfieldSpec — size and brightness ranges', () => {
  it('keeps every size within [STAR_SIZE_MIN, STAR_SIZE_MAX]', () => {
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS });
    for (let i = 0; i < spec.count; i++) {
      const s = spec.sizes[i] ?? 0;
      expect(s).toBeGreaterThanOrEqual(STAR_SIZE_MIN);
      expect(s).toBeLessThanOrEqual(STAR_SIZE_MAX);
    }
  });

  it('keeps every brightness within [STAR_BRIGHTNESS_MIN, STAR_BRIGHTNESS_MAX]', () => {
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS });
    for (let i = 0; i < spec.count; i++) {
      const b = spec.brightness[i] ?? 0;
      expect(b).toBeGreaterThanOrEqual(STAR_BRIGHTNESS_MIN);
      expect(b).toBeLessThanOrEqual(STAR_BRIGHTNESS_MAX);
    }
  });
});

describe('buildStarfieldSpec — twinkle distribution', () => {
  it('marks roughly TWINKLE_FRACTION of stars as twinklers (±0.04 tolerance)', () => {
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS });
    let twinklers = 0;
    for (let i = 0; i < spec.count; i++) {
      const amp = spec.twinkleAmps[i] ?? 0;
      if (amp > 0) twinklers++;
    }
    const fraction = twinklers / spec.count;
    expect(Math.abs(fraction - TWINKLE_FRACTION)).toBeLessThan(0.04);
  });

  it('keeps every nonzero twinkle amp within [TWINKLE_AMP_MIN, TWINKLE_AMP_MAX]', () => {
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS });
    for (let i = 0; i < spec.count; i++) {
      const amp = spec.twinkleAmps[i] ?? 0;
      if (amp === 0) continue;
      expect(amp).toBeGreaterThanOrEqual(TWINKLE_AMP_MIN);
      expect(amp).toBeLessThanOrEqual(TWINKLE_AMP_MAX);
    }
  });

  it('keeps every twinkle phase within [0, 2π)', () => {
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS });
    const twoPi = Math.PI * 2;
    for (let i = 0; i < spec.count; i++) {
      const phase = spec.twinklePhases[i] ?? 0;
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(twoPi);
    }
  });
});
```

The `?? 0` bracket-access reads exist to satisfy `noUncheckedIndexedAccess` without using suppressors. The Float32Array index is always in-bounds inside the loop; the default is unreachable in practice.

- [ ] **Step 2: Run all spec tests, confirm pass**

Run: `pnpm test src/features/scene/services/renderer/starfieldSpec.test.ts`

Expected: 9 passing tests across 5 describe blocks.

- [ ] **Step 3: Commit the distribution tests**

```bash
git add src/features/scene/services/renderer/starfieldSpec.test.ts
git commit -m "test(scene): cover starfield spec counts, ranges, distribution"
```

---

## Task 4: Material factory — failing test

**Files:**
- Create: `src/features/scene/services/renderer/starfieldMaterial.ts`
- Create: `src/features/scene/services/renderer/starfieldMaterial.test.ts`

- [ ] **Step 1: Create the stub module**

Create `src/features/scene/services/renderer/starfieldMaterial.ts`:

```ts
import { ShaderMaterial } from 'three';

export type StarfieldMaterialParams = {
  readonly color: string;
  readonly twinkleSpeed: number;
};

export const buildStarfieldMaterial = (params: StarfieldMaterialParams): ShaderMaterial => {
  throw new Error('not implemented');
};
```

- [ ] **Step 2: Write the material tests**

Create `src/features/scene/services/renderer/starfieldMaterial.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AdditiveBlending, Color, ShaderMaterial } from 'three';
import { buildStarfieldMaterial, type StarfieldMaterialParams } from './starfieldMaterial';

const PARAMS: StarfieldMaterialParams = {
  color: '#cfd9ff',
  twinkleSpeed: 1.6,
};

describe('buildStarfieldMaterial — instance', () => {
  it('returns a ShaderMaterial', () => {
    const material = buildStarfieldMaterial(PARAMS);
    expect(material).toBeInstanceOf(ShaderMaterial);
  });
});

describe('buildStarfieldMaterial — flags', () => {
  it('configures transparent, additive blending, no depth write', () => {
    const material = buildStarfieldMaterial(PARAMS);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(AdditiveBlending);
  });
});

describe('buildStarfieldMaterial — uniforms', () => {
  it('exposes uTime initialised to zero', () => {
    const material = buildStarfieldMaterial(PARAMS);
    const uTime = material.uniforms['uTime'];
    if (uTime === undefined) throw new Error('uTime uniform missing');
    expect(uTime.value).toBe(0);
  });

  it('exposes uTwinkleSpeed with the supplied value', () => {
    const material = buildStarfieldMaterial(PARAMS);
    const uTwinkleSpeed = material.uniforms['uTwinkleSpeed'];
    if (uTwinkleSpeed === undefined) throw new Error('uTwinkleSpeed uniform missing');
    expect(uTwinkleSpeed.value).toBe(1.6);
  });

  it('exposes uColor as a three.Color matching the input hex', () => {
    const material = buildStarfieldMaterial(PARAMS);
    const uColor = material.uniforms['uColor'];
    if (uColor === undefined) throw new Error('uColor uniform missing');
    const value: unknown = uColor.value;
    if (!(value instanceof Color)) throw new Error('uColor.value is not a Color');
    const expected = new Color('#cfd9ff');
    expect(value.r).toBeCloseTo(expected.r, 5);
    expect(value.g).toBeCloseTo(expected.g, 5);
    expect(value.b).toBeCloseTo(expected.b, 5);
  });

  it('exposes uPixelRatio with a positive number', () => {
    const material = buildStarfieldMaterial(PARAMS);
    const uPixelRatio = material.uniforms['uPixelRatio'];
    if (uPixelRatio === undefined) throw new Error('uPixelRatio uniform missing');
    const value = uPixelRatio.value;
    if (typeof value !== 'number') throw new Error('uPixelRatio.value is not a number');
    expect(value).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run, confirm failure**

Run: `pnpm test src/features/scene/services/renderer/starfieldMaterial.test.ts`

Expected: FAIL with `Error: not implemented`.

- [ ] **Step 4: Commit the failing tests**

```bash
git add src/features/scene/services/renderer/starfieldMaterial.ts \
        src/features/scene/services/renderer/starfieldMaterial.test.ts
git commit -m "test(scene): add failing tests for starfield material factory"
```

---

## Task 5: Implement material factory with vertex + fragment shaders

**Files:**
- Modify: `src/features/scene/services/renderer/starfieldMaterial.ts`

- [ ] **Step 1: Replace the stub with the full factory**

Replace the contents of `src/features/scene/services/renderer/starfieldMaterial.ts`:

```ts
import { AdditiveBlending, Color, ShaderMaterial } from 'three';

export type StarfieldMaterialParams = {
  readonly color: string;
  readonly twinkleSpeed: number;
};

const VERTEX_SHADER = `
attribute float aSize;
attribute float aBrightness;
attribute float aTwinkleAmp;
attribute float aTwinklePhase;

uniform float uTime;
uniform float uTwinkleSpeed;
uniform float uPixelRatio;

varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  float pulse = sin(uTime * uTwinkleSpeed + aTwinklePhase);
  float twinkle = 1.0 - aTwinkleAmp + aTwinkleAmp * (0.5 + 0.5 * pulse);

  vAlpha = aBrightness * twinkle;
  gl_PointSize = aSize * uPixelRatio;
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColor;
varying float vAlpha;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float core = smoothstep(0.25, 0.0, r2);
  gl_FragColor = vec4(uColor, vAlpha * core);
}
`;

const readDevicePixelRatio = (): number => {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio;
  if (typeof dpr !== 'number' || dpr <= 0) return 1;
  return dpr;
};

export const buildStarfieldMaterial = (params: StarfieldMaterialParams): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTwinkleSpeed: { value: params.twinkleSpeed },
      uColor: { value: new Color(params.color) },
      uPixelRatio: { value: readDevicePixelRatio() },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });
```

Notes:
- `readDevicePixelRatio` guards against `window` being undefined under jsdom (test environment) and against a non-numeric `devicePixelRatio`. The fallback to `1` keeps tests deterministic.
- `depthTest: true` is explicit even though `renderOrder=-1` makes it a near-no-op — explicit is cheap and forgiving.
- No reflection of `params.color` back through any getter; tests assert via `new Color(params.color)` and compare component-wise.

- [ ] **Step 2: Run material tests, confirm pass**

Run: `pnpm test src/features/scene/services/renderer/starfieldMaterial.test.ts`

Expected: 6 passing tests across 3 describe blocks.

- [ ] **Step 3: Commit the implementation**

```bash
git add src/features/scene/services/renderer/starfieldMaterial.ts
git commit -m "feat(scene): implement starfield ShaderMaterial factory"
```

---

## Task 6: Starfield R3F adapter component

**Files:**
- Create: `src/features/scene/components/Scene/Starfield.tsx`

- [ ] **Step 1: Create the component**

Create `src/features/scene/components/Scene/Starfield.tsx`:

```tsx
import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import {
  STAR_COUNT,
  STAR_RADIUS,
  STAR_SEED,
  buildStarfieldSpec,
} from '../../services/renderer/starfieldSpec';
import { buildStarfieldMaterial } from '../../services/renderer/starfieldMaterial';

const STAR_COLOR = '#cfd9ff';
const TWINKLE_SPEED = 1.6;

export const Starfield = (): JSX.Element => {
  const groupRef = useRef<Group | null>(null);

  const spec = useMemo(
    () => buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS }),
    [],
  );

  const material = useMemo(
    () => buildStarfieldMaterial({ color: STAR_COLOR, twinkleSpeed: TWINKLE_SPEED }),
    [],
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (group === null) return;
    group.position.copy(state.camera.position);
    const uTime = material.uniforms['uTime'];
    if (uTime === undefined) return;
    uTime.value += delta;
  });

  return (
    <group ref={groupRef}>
      <points renderOrder={-1}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[spec.positions, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[spec.sizes, 1]} />
          <bufferAttribute attach="attributes-aBrightness" args={[spec.brightness, 1]} />
          <bufferAttribute attach="attributes-aTwinkleAmp" args={[spec.twinkleAmps, 1]} />
          <bufferAttribute attach="attributes-aTwinklePhase" args={[spec.twinklePhases, 1]} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>
    </group>
  );
};
```

Notes:
- No props, no events, no domain logic. Pure visual chrome.
- `useFrame` is the only React-hook side effect — the project allows `useFrame` in components (it is the R3F-native frame hook, not a `useEffect`).
- The `uTime` uniform is read via bracket access with an `undefined` guard, satisfying `noUncheckedIndexedAccess` without suppressors. The early `return` is the correct shape; uniforms are static at construction and we never strip `uTime` from this material.
- `<bufferAttribute attach="attributes-X">` is the R3F syntax for attaching to `BufferGeometry.attributes[X]`. Matches the convention used elsewhere in the codebase.

- [ ] **Step 2: Run typecheck and lint to confirm no suppressors**

Run: `pnpm typecheck && pnpm lint && pnpm lint:suppressors`

Expected: all three pass with no errors.

- [ ] **Step 3: Commit the adapter**

```bash
git add src/features/scene/components/Scene/Starfield.tsx
git commit -m "feat(scene): add Starfield R3F adapter"
```

---

## Task 7: Wire Starfield into Scene.tsx

**Files:**
- Modify: `src/features/scene/components/Scene/Scene.tsx`

- [ ] **Step 1: Add the import**

In `src/features/scene/components/Scene/Scene.tsx`, add this import alongside the other component imports (alphabetical placement, between `ProximityWatcher` and `useSceneRefs` so it stays grouped with sibling components):

```ts
import { Starfield } from './Starfield';
```

The component imports block should become:

```ts
import { Asteroids } from './Asteroids';
import { Companies } from './Companies';
import { FollowCamera } from './FollowCamera';
import { PlanetLabels } from './PlanetLabels';
import { Player } from './Player';
import { ProximityWatcher } from './ProximityWatcher';
import { Starfield } from './Starfield';
import { useSceneRefs } from './useSceneRefs';
```

- [ ] **Step 2: Mount Starfield as the first child inside the fragment**

In `src/features/scene/components/Scene/Scene.tsx`, find the return block (currently starting on line 56) and add `<Starfield />` directly after the `<color>` background tag and before the lights. The block changes from:

```tsx
return (
  <>
    <color attach="background" args={['#04050a']} />
    <ambientLight intensity={0.4} />
```

to:

```tsx
return (
  <>
    <color attach="background" args={['#04050a']} />
    <Starfield />
    <ambientLight intensity={0.4} />
```

No other changes to `Scene.tsx`.

- [ ] **Step 3: Run the existing Scene tests**

Run: `pnpm test src/features/scene/components/Scene/Scene.test.tsx`

Expected: all existing tests pass.

If they fail with errors like `Cannot read properties of undefined (reading 'copy')` or `state.camera.position is undefined`, proceed to Task 8 to patch the test mock. Otherwise, skip Task 8 and continue to Task 9.

- [ ] **Step 4: Commit the wiring**

```bash
git add src/features/scene/components/Scene/Scene.tsx
git commit -m "feat(scene): mount Starfield as first child in Scene"
```

---

## Task 8: (Conditional) Patch Scene.test.tsx mock if it broke

**Skip this task if Task 7 Step 3 passed.**

**Files:**
- Modify: `src/features/scene/components/Scene/Scene.test.tsx`

- [ ] **Step 1: Identify the failure**

Re-run: `pnpm test src/features/scene/components/Scene/Scene.test.tsx`

If the failure is in the `useFrame` mock (which is currently `(): null => null` and so should not invoke the callback at all), no patch is needed — re-investigate why the test broke. The Starfield adapter's `useFrame` callback should NEVER execute under the current mock.

If the failure is from React rendering of `<points>`, `<bufferGeometry>`, or `<primitive object={…}>` choking jsdom, mock `Starfield` directly so the Scene-render tests don't exercise its internals.

- [ ] **Step 2: Add a Starfield mock**

In `src/features/scene/components/Scene/Scene.test.tsx`, add this `vi.mock` near the other mocks (after the `@react-three/drei` mock):

```ts
vi.mock('./Starfield', () => ({
  Starfield: (): null => null,
}));
```

Starfield has no observable effect on the Scene-level tests (it emits no events, takes no props, mutates no shared refs), so mocking it to `null` is correct: the unit under test (`Scene`) is the wiring of company/planet/label projections, not the visual backdrop.

- [ ] **Step 3: Re-run tests to confirm pass**

Run: `pnpm test src/features/scene/components/Scene/Scene.test.tsx`

Expected: all existing tests pass.

- [ ] **Step 4: Commit the mock**

```bash
git add src/features/scene/components/Scene/Scene.test.tsx
git commit -m "test(scene): mock Starfield in Scene render tests"
```

---

## Task 9: Full check + manual verification

**Files:**
- No file changes.

- [ ] **Step 1: Run the full check pipeline**

Run: `pnpm check`

This runs `typecheck`, `lint`, `lint:suppressors`, and the full `vitest` suite.

Expected: all four steps pass with zero errors and zero suppressor violations.

If `lint:suppressors` flags anything in the new files, the violation is in either:
- `starfieldSpec.ts` — should be fully clean; the `?? 0` defaults in tests are in the test file and lint rules permit defaults in tests if needed (verify locally if a rule fires).
- `Starfield.tsx` — the `uTime` access has an `undefined` guard with an early `return`, which is the project-approved shape. No `!`, no `??`, no `as`.

Fix any flagged issue at the source — never with a suppressor comment.

- [ ] **Step 2: Manual verification — `pnpm dev`**

Run: `pnpm dev`

Open the local URL in a browser. Verify:

1. **Stars are visible.** The scene background is no longer flat black — small bright dots fill the dome in every direction.
2. **Stars sit at infinity (no parallax).** Fly the ship around (arrow keys / WASD). The star pattern does not shift relative to the camera position.
3. **Stars sit behind everything.** Fly past a planet — the planet occludes the stars correctly (no z-fight, no stars bleeding through).
4. **A subset twinkles, subtly.** Hold the camera still for ~10 seconds. Watch carefully — some stars pulse on a slow ~4-second cycle. The pulse is barely noticeable; the majority are static.
5. **No clash with comets.** Watch a comet's trail cross the star field. The trail (additive blue) reads cleanly on top of the stars without colour clash or visual chaos.
6. **No frame-time regression.** Open Chrome DevTools → Performance → record 5 seconds. Frame time should be unchanged compared to the same scene on `main` (no measurable regression).
7. **Stars don't draw in front of UI overlays.** Open a company info panel by approaching a planet. The panel UI sits cleanly on top of the canvas — Starfield is inside the canvas, so this is automatic, but verify.

- [ ] **Step 3: Cross-browser / cross-DPR sanity check**

If a second display with a different DPR is available, drag the browser window between displays. Star sizes should rescale appropriately because `uPixelRatio` is set at material construction. If a window-resize triggered a noticeable size jump, that is expected behaviour for the v1 (we set `uPixelRatio` once at mount, intentionally — re-uploading on DPR change can be a later enhancement if needed).

- [ ] **Step 4: Final architectural pass**

Confirm by inspection:

- `starfieldSpec.ts` imports nothing from `react`, `@react-three/*`, or `three`. (It should import only from itself / TS built-ins.)
- `starfieldMaterial.ts` imports only from `three`.
- `Starfield.tsx` is the only file that imports from `react` and `@react-three/fiber`.
- No new file imports from `src/core/`, no new domain types, no new ports.
- `Scene.tsx` is the only file modified outside the new module set.

- [ ] **Step 5: No commit needed for this task.**

The pipeline already runs as a gate; the verification is observational.

---

## Self-review

**Spec coverage:**
- Camera-anchored sphere of stars at radius 400 → Task 6 (`group.position.copy(state.camera.position)`).
- 1500 stars, deterministic from `STAR_SEED` → Tasks 1, 2, 3 (constants + spec builder + tests).
- Single draw call → Task 6 (one `<points>` element with one geometry and one material).
- ~12% twinkling subset → Task 2 (Bernoulli with `p = TWINKLE_FRACTION`), Task 3 (ratio test with ±0.04 tolerance).
- Subtle pulse, single GPU uniform → Task 5 (vertex shader `sin(uTime * uTwinkleSpeed + aTwinklePhase)`).
- Brightness correlated with size → Task 2 (`lerp(BRIGHTNESS_MIN, BRIGHTNESS_MAX, sizeNorm)`).
- Cube-shaped size distribution → Task 2 (`sizeShaped = t * t * t`).
- Uniform-on-sphere position sampling → Task 2 (`acos(1 - 2u)`).
- Additive blending, no depth write, renderOrder = -1 → Tasks 5, 6.
- Hexagonal layer rules → enforced by file placement and Task 9 step 4 inspection.
- No domain state / no events / no port surface → file scope intentionally excludes any such files.
- Single edit to `Scene.tsx` → Task 7.

**Placeholder scan:** no TBDs, no "TODO", no "similar to Task N", every code block is concrete and copy-pasteable.

**Type consistency:**
- `StarfieldSpec` / `StarfieldSpecParams` / `StarfieldMaterialParams` consistently named across tasks.
- `buildStarfieldSpec`, `buildStarfieldMaterial` function names consistent.
- Uniform names (`uTime`, `uTwinkleSpeed`, `uColor`, `uPixelRatio`) match between Tasks 4 (tests), 5 (impl), and 6 (consumer).
- Attribute names (`aSize`, `aBrightness`, `aTwinkleAmp`, `aTwinklePhase`) match between Task 5 vertex shader and Task 6 `<bufferAttribute attach="attributes-X">`.
- Constants (`STAR_SEED`, `STAR_COUNT`, `STAR_RADIUS`, `STAR_COLOR`, `TWINKLE_SPEED`) are defined once and referenced consistently.

No gaps detected.
