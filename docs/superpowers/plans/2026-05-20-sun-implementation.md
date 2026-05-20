# Sun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stylized, light-emitting Sun at the center of the company-planet ring — 5× the size of planets, with additive corona + halo billboards, a short-range warm `PointLight` that lights the ship up close but not the planet ring, and a pure sphere-exclusion collider so the player can't fly through it. No post-processing, no new heavyweight deps.

**Architecture:** All visual effects are in-mesh (additive billboards + emissive material override), preserving the project's low-poly / colorsheet aesthetic. Pure-function modules under `services/renderer/` (animation, shader factory, sphere clamp). The `Sun` component is a pure renderer that registers its measured collider into a new ref on `useSceneRefs`. `Player` reads that ref and applies `clampOutOfSphere` after `integrateMotion`.

**Tech Stack:** React 19, `@react-three/fiber`, `@react-three/drei` (`useGLTF`, `Center`), `three` (0.184), `vitest`, `jsdom`.

**Source spec:** `docs/superpowers/specs/2026-05-20-sun-design.md`

---

## Sequencing

```
Task 1: sunAnimation        (pure, no deps)
Task 2: clampOutOfSphere    (pure, no deps)
Task 3: sunMaterial         (pure, three deps)
Task 4: useSceneRefs        (extend with sunColliderRef)  ← depends on 2
Task 5: Sun component       (consumes 1, 3, 4)
Task 6: Scene + Player wire (mounts Sun, applies clamp)   ← depends on 2, 4, 5
Task 7: Verification        (pnpm check + visual)
```

Each task ends in a commit. After every task, run `pnpm test path/to/new/test --run` (already covered in steps) before committing.

---

## Task 1: Pure sun animation function

**Files:**
- Create: `src/features/scene/services/renderer/sunAnimation.ts`
- Create: `src/features/scene/services/renderer/sunAnimation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/scene/services/renderer/sunAnimation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sunAnimationAt } from './sunAnimation';

describe('sunAnimationAt', () => {
  it('returns zero body rotation at t=0', () => {
    const state = sunAnimationAt(0);
    expect(state.bodyRotationY).toBe(0);
  });

  it('rotates the body at a constant slow rate over one second', () => {
    const a = sunAnimationAt(0);
    const b = sunAnimationAt(1);
    const rate = b.bodyRotationY - a.bodyRotationY;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(0.2);
  });

  it('returns corona pulse at baseline (1.0) at t=0', () => {
    const state = sunAnimationAt(0);
    expect(state.coronaOpacityScale).toBeCloseTo(1.0, 6);
  });

  it('returns halo pulse at baseline (1.0) at t=0 (counter-phase sine is sin(pi) = 0)', () => {
    const state = sunAnimationAt(0);
    expect(state.haloOpacityScale).toBeCloseTo(1.0, 6);
  });

  it('peaks corona opacity above baseline a quarter-period after t=0', () => {
    // CORONA_PULSE_HZ = 0.08, so quarter period = 1 / (4 * 0.08) = 3.125s
    const state = sunAnimationAt(3.125);
    expect(state.coronaOpacityScale).toBeGreaterThan(1.05);
    expect(state.coronaOpacityScale).toBeLessThan(1.11);
  });

  it('drops halo opacity below baseline a quarter-period after t=0 (counter-phase)', () => {
    // Halo phase-offset by pi from corona ⇒ at corona's peak, halo is at trough
    const state = sunAnimationAt(3.125);
    expect(state.haloOpacityScale).toBeLessThan(0.95);
    expect(state.haloOpacityScale).toBeGreaterThan(0.87);
  });

  it('is pure (same input → same output)', () => {
    expect(sunAnimationAt(5.5)).toEqual(sunAnimationAt(5.5));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test sunAnimation.test --run`
Expected: FAIL with "Cannot find module './sunAnimation'" or equivalent.

- [ ] **Step 3: Write the implementation**

Create `src/features/scene/services/renderer/sunAnimation.ts`:

```ts
export type SunAnimationState = {
  readonly bodyRotationY: number;
  readonly coronaOpacityScale: number;
  readonly haloOpacityScale: number;
};

const TWO_PI = Math.PI * 2;

// Sun rotation — discovery-time, very slow. Below the planets' base rotation
// rate so the sun reads as massive and stately, not spinning.
const SUN_ROTATION_RATE = 0.05;

// Corona and halo pulses share the frequency; halo is phase-offset by π so
// the sun "breathes" — when the inner ring brightens, the outer halo dims,
// and vice versa.
const CORONA_PULSE_HZ = 0.08;
const CORONA_PULSE_AMP = 0.1;
const HALO_PULSE_HZ = 0.08;
const HALO_PULSE_AMP = 0.12;

export const sunAnimationAt = (timeSeconds: number): SunAnimationState => ({
  bodyRotationY: timeSeconds * SUN_ROTATION_RATE,
  coronaOpacityScale:
    1 + Math.sin(timeSeconds * TWO_PI * CORONA_PULSE_HZ) * CORONA_PULSE_AMP,
  haloOpacityScale:
    1 + Math.sin(timeSeconds * TWO_PI * HALO_PULSE_HZ + Math.PI) * HALO_PULSE_AMP,
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test sunAnimation.test --run`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/services/renderer/sunAnimation.ts \
        src/features/scene/services/renderer/sunAnimation.test.ts
git commit -m "feat(scene): pure sunAnimation function (body rotation + corona/halo counter-phase pulses)"
```

---

## Task 2: Pure sphere-exclusion clamp

**Files:**
- Create: `src/features/scene/services/renderer/clampOutOfSphere.ts`
- Create: `src/features/scene/services/renderer/clampOutOfSphere.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/scene/services/renderer/clampOutOfSphere.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clampOutOfSphere, type Sphere } from './clampOutOfSphere';
import type { Vec3 } from './vec3';

const SUN: Sphere = { center: { x: 0, y: 0, z: 0 }, radius: 10 };

describe('clampOutOfSphere', () => {
  it('returns the input unchanged when the position lies strictly outside the sphere', () => {
    const result = clampOutOfSphere({ x: 20, y: 0, z: 0 }, SUN);
    expect(result).toEqual({ x: 20, y: 0, z: 0 });
  });

  it('returns the input unchanged when the position lies exactly on the sphere surface', () => {
    const result = clampOutOfSphere({ x: 10, y: 0, z: 0 }, SUN);
    expect(result).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('projects an inside-sphere position outward to the surface along the center-to-position ray', () => {
    const result = clampOutOfSphere({ x: 5, y: 0, z: 0 }, SUN);
    expect(result.x).toBeCloseTo(10, 6);
    expect(result.y).toBeCloseTo(0, 6);
    expect(result.z).toBeCloseTo(0, 6);
  });

  it('preserves the direction from center to position when projecting outward', () => {
    const result = clampOutOfSphere({ x: 3, y: 4, z: 0 }, SUN);
    expect(Math.hypot(result.x, result.y, result.z)).toBeCloseTo(10, 5);
    expect(result.x / result.y).toBeCloseTo(3 / 4, 6);
  });

  it('handles an off-center sphere by projecting onto the shifted surface', () => {
    const shifted: Sphere = { center: { x: 100, y: 0, z: 0 }, radius: 5 };
    const result = clampOutOfSphere({ x: 101, y: 0, z: 0 }, shifted);
    expect(result.x).toBeCloseTo(105, 6);
  });

  it('returns the input unchanged when sphere.radius is 0 (no-op for unmeasured colliders)', () => {
    const empty: Sphere = { center: { x: 0, y: 0, z: 0 }, radius: 0 };
    const result = clampOutOfSphere({ x: 0, y: 0, z: 0 }, empty);
    expect(result).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('returns a position on the +Y surface when the input lies exactly at center (degenerate direction)', () => {
    const result = clampOutOfSphere({ x: 0, y: 0, z: 0 }, SUN);
    expect(result).toEqual({ x: 0, y: 10, z: 0 });
  });

  it('is idempotent — clamping twice gives the same result as clamping once', () => {
    const input: Vec3 = { x: 1, y: 2, z: 3 };
    const once = clampOutOfSphere(input, SUN);
    const twice = clampOutOfSphere(once, SUN);
    expect(twice).toEqual(once);
  });

  it('does not mutate its inputs', () => {
    const position: Vec3 = { x: 1, y: 2, z: 3 };
    const positionSnapshot: Vec3 = { x: 1, y: 2, z: 3 };
    const sphereSnapshot: Sphere = {
      center: { x: SUN.center.x, y: SUN.center.y, z: SUN.center.z },
      radius: SUN.radius,
    };
    clampOutOfSphere(position, SUN);
    expect(position).toEqual(positionSnapshot);
    expect(SUN).toEqual(sphereSnapshot);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test clampOutOfSphere.test --run`
Expected: FAIL with "Cannot find module './clampOutOfSphere'".

- [ ] **Step 3: Write the implementation**

Create `src/features/scene/services/renderer/clampOutOfSphere.ts`:

```ts
import type { Vec3 } from './vec3';

export type Sphere = {
  readonly center: Vec3;
  readonly radius: number;
};

// Projects a point that lies inside a sphere outward onto the sphere's
// surface along the center→point ray. Outside-points and surface-points
// are returned unchanged. Radius-0 sphere is a no-op (used when the
// collider hasn't been measured yet — producer-reshape, no defensive
// guards at the call site).
//
// Degenerate input: when the point coincides with the center, the
// center→point ray is undefined; we return the +Y surface point as the
// arbitrary canonical choice.
export const clampOutOfSphere = (position: Vec3, sphere: Sphere): Vec3 => {
  if (sphere.radius === 0) return position;
  const dx = position.x - sphere.center.x;
  const dy = position.y - sphere.center.y;
  const dz = position.z - sphere.center.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance >= sphere.radius) return position;
  if (distance === 0) {
    return { x: sphere.center.x, y: sphere.center.y + sphere.radius, z: sphere.center.z };
  }
  const scale = sphere.radius / distance;
  return {
    x: sphere.center.x + dx * scale,
    y: sphere.center.y + dy * scale,
    z: sphere.center.z + dz * scale,
  };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test clampOutOfSphere.test --run`
Expected: PASS — 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/services/renderer/clampOutOfSphere.ts \
        src/features/scene/services/renderer/clampOutOfSphere.test.ts
git commit -m "feat(scene): pure clampOutOfSphere — projects inside-sphere points onto the surface"
```

---

## Task 3: Sun shader materials (corona + halo)

**Files:**
- Create: `src/features/scene/services/renderer/sunMaterial.ts`
- Create: `src/features/scene/services/renderer/sunMaterial.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/scene/services/renderer/sunMaterial.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AdditiveBlending, ShaderMaterial, Vector3 } from 'three';
import { createSunCoronaMaterial, createSunHaloMaterial } from './sunMaterial';

const readVec3 = (material: ShaderMaterial, name: string): Vector3 => {
  const u = material.uniforms[name];
  if (u === undefined) throw new Error(`${name} uniform missing`);
  const value: unknown = u.value;
  if (!(value instanceof Vector3)) throw new Error(`${name}.value is not a Vector3`);
  return value;
};

const readNumber = (material: ShaderMaterial, name: string): number => {
  const u = material.uniforms[name];
  if (u === undefined) throw new Error(`${name} uniform missing`);
  const value = u.value;
  if (typeof value !== 'number') throw new Error(`${name}.value is not a number`);
  return value;
};

describe('createSunCoronaMaterial', () => {
  it('returns a ShaderMaterial instance', () => {
    expect(createSunCoronaMaterial()).toBeInstanceOf(ShaderMaterial);
  });

  it('uses additive blending with depthWrite off and tone mapping off', () => {
    const m = createSunCoronaMaterial();
    expect(m.blending).toBe(AdditiveBlending);
    expect(m.depthWrite).toBe(false);
    expect(m.transparent).toBe(true);
    expect(m.toneMapped).toBe(false);
  });

  it('exposes a warm-yellow core color uniform', () => {
    const core = readVec3(createSunCoronaMaterial(), 'uColorCore');
    expect(core.x).toBeGreaterThan(0.9);
    expect(core.y).toBeGreaterThan(0.8);
    expect(core.z).toBeGreaterThan(0.5);
    expect(core.z).toBeLessThan(core.x);
  });

  it('exposes a warm-amber rim color uniform', () => {
    const rim = readVec3(createSunCoronaMaterial(), 'uColorRim');
    expect(rim.x).toBeGreaterThan(0.9);
    expect(rim.y).toBeGreaterThan(rim.z);
  });

  it('exposes uOpacityScale initialised to 1', () => {
    expect(readNumber(createSunCoronaMaterial(), 'uOpacityScale')).toBe(1);
  });

  it('exposes uFalloff (corona has a sharpish edge — exponent > 1)', () => {
    expect(readNumber(createSunCoronaMaterial(), 'uFalloff')).toBeGreaterThan(1);
  });

  it('exposes uPeakOpacity equal to 1 (corona is bright)', () => {
    expect(readNumber(createSunCoronaMaterial(), 'uPeakOpacity')).toBe(1);
  });
});

describe('createSunHaloMaterial', () => {
  it('returns a ShaderMaterial instance', () => {
    expect(createSunHaloMaterial()).toBeInstanceOf(ShaderMaterial);
  });

  it('uses additive blending with depthWrite off and tone mapping off', () => {
    const m = createSunHaloMaterial();
    expect(m.blending).toBe(AdditiveBlending);
    expect(m.depthWrite).toBe(false);
    expect(m.transparent).toBe(true);
    expect(m.toneMapped).toBe(false);
  });

  it('exposes uPeakOpacity well below the corona (softer outer glow)', () => {
    const halo = readNumber(createSunHaloMaterial(), 'uPeakOpacity');
    const corona = readNumber(createSunCoronaMaterial(), 'uPeakOpacity');
    expect(halo).toBeLessThan(corona);
    expect(halo).toBeCloseTo(0.25, 5);
  });

  it('exposes a warmer rim color skewed toward orange compared to the corona rim', () => {
    const haloRim = readVec3(createSunHaloMaterial(), 'uColorRim');
    const coronaRim = readVec3(createSunCoronaMaterial(), 'uColorRim');
    expect(haloRim.z).toBeLessThan(coronaRim.z);
  });

  it('exposes uOpacityScale initialised to 1', () => {
    expect(readNumber(createSunHaloMaterial(), 'uOpacityScale')).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test sunMaterial.test --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/features/scene/services/renderer/sunMaterial.ts`:

```ts
import { AdditiveBlending, ShaderMaterial, Vector3 } from 'three';

// Billboarded radial-gradient quad. Position is treated as a 2D position
// inside the quad; the fragment computes radius from center to draw the
// disk. The same shader serves corona (sharp falloff, high peak) and halo
// (soft falloff, low peak) via uniforms.
const VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColorCore;
uniform vec3 uColorRim;
uniform float uFalloff;
uniform float uPeakOpacity;
uniform float uOpacityScale;

varying vec2 vUv;

void main() {
  // 0 at center, 1 at the corner of the quad. We clamp to a unit disk so
  // the quad's corners don't show — anything beyond r=1 is transparent.
  float r = clamp(length(vUv - vec2(0.5)) * 2.0, 0.0, 1.0);

  // Falloff curve: pow(1 - r, uFalloff) — high exponent = sharp edge,
  // low exponent = soft soft halo.
  float intensity = pow(1.0 - r, uFalloff);

  // Color tween from core to rim with radius.
  vec3 color = mix(uColorCore, uColorRim, r);

  float alpha = intensity * uPeakOpacity * uOpacityScale;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

// Inner corona — bright, sharp-edged disk.
export const createSunCoronaMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uColorCore: { value: new Vector3(1.0, 0.91, 0.69) }, // #ffe9b0
      uColorRim:  { value: new Vector3(1.0, 0.81, 0.45) }, // #ffcf72
      uFalloff:   { value: 2.4 },
      uPeakOpacity: { value: 1.0 },
      uOpacityScale: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });

// Outer halo — soft, wide, low-opacity glow.
export const createSunHaloMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uColorCore: { value: new Vector3(1.0, 0.81, 0.45) }, // #ffcf72
      uColorRim:  { value: new Vector3(1.0, 0.6, 0.23) },  // #ff9a3a (lower B than corona rim)
      uFalloff:   { value: 1.6 },
      uPeakOpacity: { value: 0.25 },
      uOpacityScale: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test sunMaterial.test --run`
Expected: PASS — corona has 7 green, halo has 4 green.

- [ ] **Step 5: Commit**

```bash
git add src/features/scene/services/renderer/sunMaterial.ts \
        src/features/scene/services/renderer/sunMaterial.test.ts
git commit -m "feat(scene): additive radial sun materials (corona + halo) — stylized in-mesh glow"
```

---

## Task 4: Add `SunCollider` ref to `useSceneRefs`

**Files:**
- Modify: `src/features/scene/components/Scene/useSceneRefs.ts`

Add a `SunCollider` registry mirroring the existing `PlanetRadii` TotalMap pattern — `read()` returns a `Sphere` even when not yet measured (folds the unmeasured case to `radius: 0`, which `clampOutOfSphere` handles as a no-op).

- [ ] **Step 1: Edit `useSceneRefs.ts`**

Open `src/features/scene/components/Scene/useSceneRefs.ts` and apply these edits:

**(a) Add imports at the top of the file (after the existing `import type { Object3D } from 'three';` line):**

```ts
import type { Sphere } from '../../services/renderer/clampOutOfSphere';
```

**(b) Insert the new type + factory after the `createPlanetActivations` factory (and before `type SceneRefs`):**

```ts
// Single-sphere collider registry for the sun. `read` always returns a
// `Sphere` — the unmeasured case is folded into a degenerate radius-0
// sphere so callers never see undefined. `clampOutOfSphere` treats
// radius-0 as a no-op, so an unmeasured sun produces no clamp side-effect.
export type SunCollider = {
  readonly read: () => Sphere;
  readonly write: (sphere: Sphere) => void;
};

const EMPTY_SPHERE: Sphere = { center: { x: 0, y: 0, z: 0 }, radius: 0 };

const createSunCollider = (): SunCollider => {
  let current: Sphere = EMPTY_SPHERE;
  return {
    read: () => current,
    write: (sphere) => {
      current = sphere;
    },
  };
};
```

**(c) Add `sunColliderRef` to the `SceneRefs` type:**

```ts
type SceneRefs = {
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly meshRef: RefObject<Object3D | null>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly sunColliderRef: RefObject<SunCollider>;
};
```

**(d) Update `useSceneRefs` to create and return the new ref:**

```ts
export const useSceneRefs = (): SceneRefs => {
  const kinematicsRef = useRef<Kinematics>(INITIAL_KINEMATICS);
  const meshRef = useRef<Object3D | null>(null);
  const planetRadiiRef = useRef<PlanetRadii>(createPlanetRadii());
  const planetActivationsRef = useRef<PlanetActivations>(createPlanetActivations());
  const sunColliderRef = useRef<SunCollider>(createSunCollider());
  return { kinematicsRef, meshRef, planetRadiiRef, planetActivationsRef, sunColliderRef };
};
```

- [ ] **Step 2: Verify typecheck + tests still pass**

Run: `pnpm typecheck && pnpm test --run`
Expected: PASS — no type errors, all existing tests still green.

- [ ] **Step 3: Commit**

```bash
git add src/features/scene/components/Scene/useSceneRefs.ts
git commit -m "feat(scene): add sunColliderRef to useSceneRefs (TotalMap-style sphere registry)"
```

---

## Task 5: `Sun` component (pure renderer)

**Files:**
- Create: `src/features/scene/components/Scene/Sun.tsx`

`Sun.tsx` is a pure renderer (no router / api / store). It loads the sun GLB, applies an emissive override to the body, mounts two billboarded additive quads (corona + halo) and a short-range `PointLight`, and writes its measured world-radius into `sunColliderRef`. Per-frame work is delegated to `useFrame` calling `sunAnimationAt`.

- [ ] **Step 1: Write `Sun.tsx`**

Create `src/features/scene/components/Scene/Sun.tsx`:

```tsx
import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Object3D,
  type ShaderMaterial,
} from 'three';
import {
  PLANET_PATHS,
  COLORSHEET_PATH,
  configureColorsheet,
} from '../../services/renderer/planetAssets';
import { extractBody } from '../../services/renderer/planetVisualPlan';
import {
  createSunCoronaMaterial,
  createSunHaloMaterial,
} from '../../services/renderer/sunMaterial';
import { sunAnimationAt } from '../../services/renderer/sunAnimation';
import type { SunCollider } from './useSceneRefs';

type SunProps = {
  readonly sunColliderRef: RefObject<SunCollider>;
};

const SUN_BODY_SCALE = 7.5; // 5× PLANET_BASE_SCALE (1.5)
const CORONA_SCALE_OF_DIAMETER = 1.5;
const HALO_SCALE_OF_DIAMETER = 3.5;

const SUN_LIGHT_COLOR = '#ffcf8f';
const SUN_LIGHT_INTENSITY = 120;
const SUN_LIGHT_DISTANCE = 45;
const SUN_LIGHT_DECAY = 2;

const SUN_EMISSIVE_HEX = 0xffe9b0;
const SUN_EMISSIVE_INTENSITY = 1.2;

// Applies the warm emissive override to every MeshStandardMaterial on the
// sun body so the sphere reads as a hot source under any tone-mapping setup.
const overrideSunMaterials = (root: Object3D): void => {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.emissive = new Color(SUN_EMISSIVE_HEX);
      material.emissiveIntensity = SUN_EMISSIVE_INTENSITY;
      material.toneMapped = false;
    }
  });
};

type Billboard = { readonly mesh: Mesh; readonly material: ShaderMaterial };

// Billboards live OUTSIDE the body's scaled group, so we size them in world
// units directly: world diameter = bodyRadiusLocal * 2 * SUN_BODY_SCALE * scale.
const makeBillboard = (material: ShaderMaterial, worldDiameter: number): Billboard => {
  const geometry = new PlaneGeometry(worldDiameter, worldDiameter);
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 1;
  return { mesh, material };
};

// Uniform names live in a string-indexed map (Three's design — type system's
// actual blind spot). We narrow at read time and throw on missing keys.
// This is not a defensive runtime check on a typed value; it's the parse-
// boundary equivalent for an externally-keyed map.
const setOpacityScale = (material: ShaderMaterial, value: number): void => {
  const u = material.uniforms['uOpacityScale'];
  if (u === undefined) throw new Error('uOpacityScale uniform missing on sun material');
  u.value = value;
};

const useSunFrame = (
  bodyRef: RefObject<Object3D | null>,
  corona: Billboard,
  halo: Billboard,
): void => {
  useFrame((state) => {
    const body = bodyRef.current;
    const animation = sunAnimationAt(state.clock.elapsedTime);
    if (body !== null) body.rotation.y = animation.bodyRotationY;
    setOpacityScale(corona.material, animation.coronaOpacityScale);
    setOpacityScale(halo.material, animation.haloOpacityScale);
    // Billboard both quads at the camera each frame.
    corona.mesh.quaternion.copy(state.camera.quaternion);
    halo.mesh.quaternion.copy(state.camera.quaternion);
  });
};

export const Sun = (props: SunProps): JSX.Element => {
  const { scene } = useGLTF(PLANET_PATHS['sun_b']);
  const colorsheet = useTexture(COLORSHEET_PATH);

  const prepared = useMemo(() => {
    configureColorsheet(colorsheet);
    overrideSunMaterials(scene);
    return scene;
  }, [scene, colorsheet]);

  const extraction = useMemo(() => extractBody(prepared), [prepared]);
  const bodyRadiusLocal = extraction.kind === 'no_body' ? 0 : extraction.radius;
  const worldRadius = bodyRadiusLocal * SUN_BODY_SCALE;
  const worldDiameter = worldRadius * 2;

  // Register the measured collider sphere into the scene-wide ref.
  props.sunColliderRef.current.write({
    center: { x: 0, y: 0, z: 0 },
    radius: worldRadius,
  });

  const corona = useMemo(
    () => makeBillboard(createSunCoronaMaterial(), worldDiameter * CORONA_SCALE_OF_DIAMETER),
    [worldDiameter],
  );
  const halo = useMemo(
    () => makeBillboard(createSunHaloMaterial(), worldDiameter * HALO_SCALE_OF_DIAMETER),
    [worldDiameter],
  );

  const bodyRef = useRef<Object3D | null>(null);
  useSunFrame(bodyRef, corona, halo);

  return (
    <group position={[0, 0, 0]}>
      <pointLight
        color={SUN_LIGHT_COLOR}
        intensity={SUN_LIGHT_INTENSITY}
        distance={SUN_LIGHT_DISTANCE}
        decay={SUN_LIGHT_DECAY}
        castShadow={false}
      />
      <group ref={bodyRef} scale={[SUN_BODY_SCALE, SUN_BODY_SCALE, SUN_BODY_SCALE]}>
        <primitive object={prepared} />
      </group>
      <primitive object={corona.mesh} />
      <primitive object={halo.mesh} />
    </group>
  );
};
```

(No explicit `useGLTF.preload(PLANET_PATHS['sun_b'])` needed — `Planet.tsx` already preloads every entry of `PLANET_PATHS`, including the sun.)

- [ ] **Step 2: Verify typecheck + lint + suppressor scan**

Run: `pnpm typecheck && pnpm lint && pnpm lint:suppressors`
Expected: PASS — no `!` postfix in Sun.tsx, no `??` on uniform lookup, no errors.

- [ ] **Step 3: Run existing tests to confirm no regressions**

Run: `pnpm test --run`
Expected: All existing tests still PASS (Sun.tsx has no unit test — visual verification in Task 7).

- [ ] **Step 4: Commit**

```bash
git add src/features/scene/components/Scene/Sun.tsx
git commit -m "feat(scene): Sun component — emissive body + additive corona/halo billboards + point light"
```

---

## Task 6: Wire `<Sun />` into `Scene` and apply collider in `Player`

**Files:**
- Modify: `src/features/scene/components/Scene/Scene.tsx`
- Modify: `src/features/scene/components/Scene/Player.tsx`

- [ ] **Step 1: Edit `Scene.tsx`**

Open `src/features/scene/components/Scene/Scene.tsx` and apply:

**(a) Add the Sun import:**

```ts
import { Sun } from './Sun';
```

**(b) Destructure `sunColliderRef` from `useSceneRefs`:**

```ts
const { kinematicsRef, meshRef, planetRadiiRef, planetActivationsRef, sunColliderRef } =
  useSceneRefs();
```

**(c) Pass `sunColliderRef` to `<Player ... />`:**

```tsx
<Player
  ship={props.ship}
  sceneState={props.state}
  intents={props.intents}
  kinematicsRef={kinematicsRef}
  meshRef={meshRef}
  sunColliderRef={sunColliderRef}
/>
```

**(d) Mount `<Sun />` right after `<Starfield />` and before the `ambientLight`:**

```tsx
<Starfield />
<Sun sunColliderRef={sunColliderRef} />
<ambientLight intensity={0.4} />
```

(Do NOT touch the two `<directionalLight />` lines — they remain.)

- [ ] **Step 2: Edit `Player.tsx`**

Open `src/features/scene/components/Scene/Player.tsx` and apply:

**(a) Add the import for the clamp + type:**

```ts
import { clampOutOfSphere } from '../../services/renderer/clampOutOfSphere';
import type { SunCollider } from './useSceneRefs';
```

**(b) Extend `PlayerProps` with `sunColliderRef`:**

```ts
type PlayerProps = {
  readonly ship: ShipEntry;
  readonly sceneState: SceneState;
  readonly intents: IntentStream;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly meshRef: RefObject<Object3D | null>;
  readonly sunColliderRef: RefObject<SunCollider>;
};
```

**(c) In `usePlayerFrame`, immediately after the `props.kinematicsRef.current = next;` line, insert the clamp step. Replace this block:**

```ts
    const next = integrateMotion(
      props.kinematicsRef.current,
      props.intents.current,
      delta,
      basis,
    );
    props.kinematicsRef.current = next;
```

**with:**

```ts
    const integrated = integrateMotion(
      props.kinematicsRef.current,
      props.intents.current,
      delta,
      basis,
    );
    const clampedPosition = clampOutOfSphere(
      integrated.position,
      props.sunColliderRef.current.read(),
    );
    const next: Kinematics =
      clampedPosition === integrated.position
        ? integrated
        : { ...integrated, position: clampedPosition };
    props.kinematicsRef.current = next;
```

Then anywhere `next.velocity` and `next.position` are read further down, leave them — they remain valid. The position is the only thing that may have changed.

- [ ] **Step 3: Verify the whole check pipeline**

Run: `pnpm check`
Expected: PASS — typecheck, lint, suppressor scan, and all tests all green.

- [ ] **Step 4: Commit**

```bash
git add src/features/scene/components/Scene/Scene.tsx \
        src/features/scene/components/Scene/Player.tsx
git commit -m "feat(scene): mount Sun and apply sun collider clamp to player motion"
```

---

## Task 7: Visual verification + acceptance

**Files:** none — manual verification only.

- [ ] **Step 1: Run the dev server**

Run: `pnpm dev`
Open the URL the server prints (likely `http://localhost:5173`).

- [ ] **Step 2: Confirm visual acceptance criteria (one by one)**

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | Sun visible at scene center | Look at the origin — large warm sphere should be there |
| 2 | Sun is ~5× planet size | Visually compare to the planets on the ring |
| 3 | Corona ring visible around body | Tight warm halo immediately around the disk |
| 4 | Outer halo visible | Softer, wider, more orange glow further out |
| 5 | Pulses are subtle (not strobing) | Watch for 5–10 seconds — should "breathe" gently |
| 6 | Corona/halo are counter-phase | At any moment one is brighter and the other dimmer |
| 7 | Ship warms up near the sun | Fly toward the sun — ship materials gain warm tint |
| 8 | Ring planets unchanged | Visually identical to before this PR at distance ~80 |
| 9 | Can't fly through the sun | Drive straight at it — motion stops at the surface |
| 10 | Can slide along the surface | Strafe sideways while pressed against it — works |

If any criterion fails, **do not commit further changes blindly**. Open `docs/superpowers/specs/2026-05-20-sun-design.md`, identify which numeric constant most likely controls the failing criterion (e.g. criterion 7 → `SUN_LIGHT_INTENSITY` / `SUN_LIGHT_DISTANCE`), tune it, re-run, re-check. Commit each tuning pass as a fixup.

- [ ] **Step 3: Final `pnpm check` and commit any tuning**

Run: `pnpm check`
Expected: PASS.

If you tuned constants in step 2, commit those:

```bash
git add src/features/scene/components/Scene/Sun.tsx
git commit -m "chore(scene): tune sun visual constants (intensity / falloff / scale)"
```

If no tuning was needed, no commit.

- [ ] **Step 4: Done — mark feature complete**

The sun feature is now live, tested, type-safe, lint-clean, and visually verified. The collider is registered and applied. No new heavyweight dependencies were added. Post-implementation review: the implementing engineer may now invoke the project's `core-architecture-guardian` and `rules-guardian` agents (per CLAUDE.md orchestration) to audit the diff against the Four Iron Laws before merging.
