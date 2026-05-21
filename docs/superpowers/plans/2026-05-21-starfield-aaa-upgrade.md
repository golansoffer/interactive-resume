# Starfield AAA Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing starfield to AAA visual quality through per-star color temperature, in-shader bloom halos on the brightest ~5%, diffraction spikes on the top ~1.5%, per-star twinkle speed + curve variety with actually-visible amplitude, and a slow-parallax near-layer — all on a single shared `ShaderMaterial` across two camera-following `Points` meshes, no postprocessing pass.

**Architecture:** Three existing files are extended in place: `starfieldSpec.ts` (pure spec builder) gets new constants, a discriminated `layer: 'far' | 'near'` params union, and four new per-star attribute arrays (`colors`, `luminous`, `twinkleSpeeds`, `twinkleSharps`); `starfieldMaterial.ts` gains new uniforms (`uHaloSizeBoost`, `uHaloStrength`, `uSpikeStrength`), per-star attribute wiring (`aColor`, `aLuminous`, `aTwinkleSpeed`, `aTwinkleSharp`), and a fragment shader that gates halo + spike work by `vLuminous`; `Starfield.tsx` builds far + near spec instances and renders two `<points>` groups, the near one drifting at `0.6×` camera position. Per-star variation is entirely attribute-driven so one shared material handles both layers.

**Tech Stack:** TypeScript, vitest (test runner), three.js (`ShaderMaterial`, GLSL), `@react-three/fiber` (`<points>`, `<group>`, `useFrame`), `pnpm` task runner. Existing project conventions: discriminated unions tagged by `kind`, pure spec builders, `Math.fround` for float32-precision test bounds.

**Spec:** `docs/superpowers/specs/2026-05-21-starfield-aaa-design.md` — read this in full before starting Task 1.

**Task structure:** Each of the six tasks is an additive wave that leaves the codebase in a complete, shippable state. No scaffolding, no stubs, no constants that exist only to be deleted later. Task N never modifies a value Task N-1 set as a placeholder — every value written is its final value, and every later task adds *new* values or layers.

---

## Task 1: Extend the spec — types, constants, color, twinkle variety

Rewrite `starfieldSpec.ts` with the full new type shape, the layer-tagged params union, the six-tint palette with weighted distributions, per-star twinkle speed in `[0.4, 2.5]`, smooth/sharp curve flag, and the expanded amplitude ranges. The luminous tier and the brightness bias on twinkler selection are deferred to Task 2 (those are post-pass / selection-formula changes that build *on top of* this task's output without rewriting it).

After this task:
- All new arrays carry their final color and twinkle-variety values.
- The starfield twinkle is already visibly more varied (speeds 0.4..2.5, smooth + sharp curves, amps 0.35..0.85) than before.
- `luminous` is all-zero; the luminous-tier features and the brightness-rank bias on selection arrive in Task 2.

**Files:**
- Modify: `src/features/scene/services/renderer/starfieldSpec.ts` (full rewrite)
- Modify: `src/features/scene/services/renderer/starfieldSpec.test.ts` (full rewrite)
- Modify: `src/features/scene/components/Scene/Starfield.tsx` (call-site update so the codebase typechecks at task end — Task 5 expands this further)

- [ ] **Step 1: Write the failing tests for the new spec shape, color, and twinkle variety**

Replace the contents of `src/features/scene/services/renderer/starfieldSpec.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import {
  STAR_BRIGHTNESS_MAX,
  STAR_BRIGHTNESS_MIN,
  STAR_COUNT_FAR,
  STAR_RADIUS_FAR,
  STAR_SEED,
  STAR_SIZE_MAX,
  STAR_SIZE_MIN,
  TWINKLE_AMP_SHARP_MAX,
  TWINKLE_AMP_SHARP_MIN,
  TWINKLE_AMP_SMOOTH_MAX,
  TWINKLE_AMP_SMOOTH_MIN,
  TWINKLE_FRACTION,
  TWINKLE_SHARP_FRACTION,
  TWINKLE_SPEED_MAX,
  TWINKLE_SPEED_MIN,
  buildStarfieldSpec,
} from './starfieldSpec';

const arraysEqual = (a: Float32Array, b: Float32Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const buildDefaultFar = (): ReturnType<typeof buildStarfieldSpec> =>
  buildStarfieldSpec({ layer: 'far', seed: STAR_SEED, count: STAR_COUNT_FAR, radius: STAR_RADIUS_FAR });

const PALETTE_HEXES: ReadonlyArray<readonly [number, number, number]> = [
  [0xbc / 255, 0xd0 / 255, 0xff / 255], // cool blue-white
  [0xee / 255, 0xf2 / 255, 0xff / 255], // neutral white
  [0xff / 255, 0xf4 / 255, 0xdc / 255], // warm white
  [0xff / 255, 0xc8 / 255, 0x9a / 255], // orange
  [0xff / 255, 0x92 / 255, 0x72 / 255], // deep red-orange
  [0xa0 / 255, 0xb8 / 255, 0xff / 255], // hot blue
];

const colorAt = (
  spec: ReturnType<typeof buildStarfieldSpec>,
  i: number,
): readonly [number, number, number] => {
  const r = spec.colors[i * 3 + 0] ?? 0;
  const g = spec.colors[i * 3 + 1] ?? 0;
  const b = spec.colors[i * 3 + 2] ?? 0;
  return [r, g, b];
};

const colorMatchesBucket = (
  c: readonly [number, number, number],
  bucket: readonly [number, number, number],
): boolean => {
  const eps = 1e-3;
  return (
    Math.abs(c[0] - bucket[0]) < eps &&
    Math.abs(c[1] - bucket[1]) < eps &&
    Math.abs(c[2] - bucket[2]) < eps
  );
};

const sizeMin32 = Math.fround(STAR_SIZE_MIN);
const sizeMax32 = Math.fround(STAR_SIZE_MAX);
const brightnessMin32 = Math.fround(STAR_BRIGHTNESS_MIN);
const brightnessMax32 = Math.fround(STAR_BRIGHTNESS_MAX);
const twinkleAmpSmoothMin32 = Math.fround(TWINKLE_AMP_SMOOTH_MIN);
const twinkleAmpSmoothMax32 = Math.fround(TWINKLE_AMP_SMOOTH_MAX);
const twinkleAmpSharpMin32 = Math.fround(TWINKLE_AMP_SHARP_MIN);
const twinkleAmpSharpMax32 = Math.fround(TWINKLE_AMP_SHARP_MAX);
const twinkleSpeedMin32 = Math.fround(TWINKLE_SPEED_MIN);
const twinkleSpeedMax32 = Math.fround(TWINKLE_SPEED_MAX);

describe('buildStarfieldSpec — determinism', () => {
  it('returns identical arrays across two calls with the same params', () => {
    const a = buildStarfieldSpec({ layer: 'far', seed: 1, count: 100, radius: 10 });
    const b = buildStarfieldSpec({ layer: 'far', seed: 1, count: 100, radius: 10 });
    expect(arraysEqual(a.positions, b.positions)).toBe(true);
    expect(arraysEqual(a.sizes, b.sizes)).toBe(true);
    expect(arraysEqual(a.brightness, b.brightness)).toBe(true);
    expect(arraysEqual(a.colors, b.colors)).toBe(true);
    expect(arraysEqual(a.luminous, b.luminous)).toBe(true);
    expect(arraysEqual(a.twinkleAmps, b.twinkleAmps)).toBe(true);
    expect(arraysEqual(a.twinkleSpeeds, b.twinkleSpeeds)).toBe(true);
    expect(arraysEqual(a.twinkleSharps, b.twinkleSharps)).toBe(true);
    expect(arraysEqual(a.twinklePhases, b.twinklePhases)).toBe(true);
  });

  it('returns different arrays for different seeds', () => {
    const a = buildStarfieldSpec({ layer: 'far', seed: 1, count: 100, radius: 10 });
    const b = buildStarfieldSpec({ layer: 'far', seed: 2, count: 100, radius: 10 });
    expect(arraysEqual(a.positions, b.positions)).toBe(false);
  });
});

describe('buildStarfieldSpec — shape', () => {
  it('produces arrays sized to the requested count', () => {
    const spec = buildDefaultFar();
    expect(spec.count).toBe(STAR_COUNT_FAR);
    expect(spec.positions.length).toBe(STAR_COUNT_FAR * 3);
    expect(spec.sizes.length).toBe(STAR_COUNT_FAR);
    expect(spec.brightness.length).toBe(STAR_COUNT_FAR);
    expect(spec.colors.length).toBe(STAR_COUNT_FAR * 3);
    expect(spec.luminous.length).toBe(STAR_COUNT_FAR);
    expect(spec.twinkleAmps.length).toBe(STAR_COUNT_FAR);
    expect(spec.twinkleSpeeds.length).toBe(STAR_COUNT_FAR);
    expect(spec.twinkleSharps.length).toBe(STAR_COUNT_FAR);
    expect(spec.twinklePhases.length).toBe(STAR_COUNT_FAR);
  });

  it('tags the result with the starfield_spec kind and propagates the layer', () => {
    const far = buildStarfieldSpec({ layer: 'far', seed: STAR_SEED, count: 10, radius: 1 });
    const near = buildStarfieldSpec({ layer: 'near', seed: STAR_SEED, count: 10, radius: 1 });
    expect(far.kind).toBe('starfield_spec');
    expect(far.layer).toBe('far');
    expect(near.layer).toBe('near');
  });
});

describe('buildStarfieldSpec — positions on the sphere', () => {
  it('places every star at the requested radius (within float tolerance)', () => {
    const radius = 400;
    const spec = buildStarfieldSpec({ layer: 'far', seed: STAR_SEED, count: 500, radius });
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
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count; i++) {
      const s = spec.sizes[i] ?? 0;
      expect(s).toBeGreaterThanOrEqual(sizeMin32);
      expect(s).toBeLessThanOrEqual(sizeMax32);
    }
  });

  it('keeps every brightness within [STAR_BRIGHTNESS_MIN, STAR_BRIGHTNESS_MAX]', () => {
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count; i++) {
      const b = spec.brightness[i] ?? 0;
      expect(b).toBeGreaterThanOrEqual(brightnessMin32);
      expect(b).toBeLessThanOrEqual(brightnessMax32);
    }
  });
});

describe('buildStarfieldSpec — color', () => {
  it('keeps every color channel within [0, 1]', () => {
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count * 3; i++) {
      const c = spec.colors[i] ?? 0;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('produces colors only from the configured palette', () => {
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count; i++) {
      const c = colorAt(spec, i);
      const matched = PALETTE_HEXES.some((bucket) => colorMatchesBucket(c, bucket));
      expect(matched).toBe(true);
    }
  });

  it('matches base-palette weights for the middle 30%-95% brightness band (±0.06)', () => {
    const spec = buildDefaultFar();
    const sorted = Array.from(spec.brightness).slice().sort((a, b) => a - b);
    const p30 = sorted[Math.floor(0.3 * spec.count)] ?? 0;
    const p95 = sorted[Math.floor(0.95 * spec.count)] ?? 0;
    const counts = new Array<number>(PALETTE_HEXES.length).fill(0);
    let total = 0;
    for (let i = 0; i < spec.count; i++) {
      const b = spec.brightness[i] ?? 0;
      if (b < p30 || b >= p95) continue;
      const c = colorAt(spec, i);
      const idx = PALETTE_HEXES.findIndex((bucket) => colorMatchesBucket(c, bucket));
      if (idx < 0) continue;
      counts[idx] = (counts[idx] ?? 0) + 1;
      total++;
    }
    const expected = [0.15, 0.4, 0.25, 0.12, 0.05, 0.03];
    for (let i = 0; i < counts.length; i++) {
      const observed = (counts[i] ?? 0) / total;
      expect(Math.abs(observed - (expected[i] ?? 0))).toBeLessThan(0.06);
    }
  });

  it('excludes deep red-orange and hot blue from the dim 30% (those tints are reserved for brighter populations)', () => {
    const spec = buildDefaultFar();
    const sorted = Array.from(spec.brightness).slice().sort((a, b) => a - b);
    const p30 = sorted[Math.floor(0.3 * spec.count)] ?? 0;
    let excluded = 0;
    let totalDim = 0;
    for (let i = 0; i < spec.count; i++) {
      const b = spec.brightness[i] ?? 0;
      if (b >= p30) continue;
      totalDim++;
      const c = colorAt(spec, i);
      if (colorMatchesBucket(c, PALETTE_HEXES[4] ?? [0, 0, 0])) excluded++;
      if (colorMatchesBucket(c, PALETTE_HEXES[5] ?? [0, 0, 0])) excluded++;
    }
    expect(totalDim).toBeGreaterThan(0);
    expect(excluded).toBe(0);
  });
});

describe('buildStarfieldSpec — twinkle variety', () => {
  it('marks roughly TWINKLE_FRACTION of stars as twinklers (binomial tolerance — fraction in [0.12, 0.17])', () => {
    const spec = buildDefaultFar();
    let twinklers = 0;
    for (let i = 0; i < spec.count; i++) {
      const amp = spec.twinkleAmps[i] ?? 0;
      if (amp > 0) twinklers++;
    }
    const fraction = twinklers / spec.count;
    expect(fraction).toBeGreaterThanOrEqual(0.12);
    expect(fraction).toBeLessThanOrEqual(0.17);
    // sanity: TWINKLE_FRACTION constant itself is 0.14
    expect(TWINKLE_FRACTION).toBeCloseTo(0.14, 5);
  });

  it('classifies roughly TWINKLE_SHARP_FRACTION of twinklers as sharp (within ±0.08)', () => {
    const spec = buildDefaultFar();
    let twinklers = 0;
    let sharp = 0;
    for (let i = 0; i < spec.count; i++) {
      const amp = spec.twinkleAmps[i] ?? 0;
      if (amp === 0) continue;
      twinklers++;
      if ((spec.twinkleSharps[i] ?? 0) === 1) sharp++;
    }
    expect(twinklers).toBeGreaterThan(0);
    const observed = sharp / twinklers;
    expect(Math.abs(observed - TWINKLE_SHARP_FRACTION)).toBeLessThan(0.08);
  });

  it('keeps smooth-twinkler amps within [TWINKLE_AMP_SMOOTH_MIN, TWINKLE_AMP_SMOOTH_MAX]', () => {
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count; i++) {
      const amp = spec.twinkleAmps[i] ?? 0;
      if (amp === 0) continue;
      if ((spec.twinkleSharps[i] ?? 0) === 1) continue;
      expect(amp).toBeGreaterThanOrEqual(twinkleAmpSmoothMin32);
      expect(amp).toBeLessThanOrEqual(twinkleAmpSmoothMax32);
    }
  });

  it('keeps sharp-twinkler amps within [TWINKLE_AMP_SHARP_MIN, TWINKLE_AMP_SHARP_MAX]', () => {
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count; i++) {
      const amp = spec.twinkleAmps[i] ?? 0;
      if (amp === 0) continue;
      if ((spec.twinkleSharps[i] ?? 0) !== 1) continue;
      expect(amp).toBeGreaterThanOrEqual(twinkleAmpSharpMin32);
      expect(amp).toBeLessThanOrEqual(twinkleAmpSharpMax32);
    }
  });

  it('assigns each twinkler a per-star speed within [TWINKLE_SPEED_MIN, TWINKLE_SPEED_MAX]', () => {
    const spec = buildDefaultFar();
    let twinklers = 0;
    const speedsSeen = new Set<number>();
    for (let i = 0; i < spec.count; i++) {
      const amp = spec.twinkleAmps[i] ?? 0;
      if (amp === 0) continue;
      twinklers++;
      const speed = spec.twinkleSpeeds[i] ?? 0;
      expect(speed).toBeGreaterThanOrEqual(twinkleSpeedMin32);
      expect(speed).toBeLessThanOrEqual(twinkleSpeedMax32);
      speedsSeen.add(Math.round(speed * 100) / 100);
    }
    expect(twinklers).toBeGreaterThan(0);
    // Sanity: not every twinkler shares the same speed.
    expect(speedsSeen.size).toBeGreaterThan(10);
  });

  it('zeros twinkleSpeed for non-twinklers', () => {
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count; i++) {
      const amp = spec.twinkleAmps[i] ?? 0;
      if (amp > 0) continue;
      expect(spec.twinkleSpeeds[i] ?? 0).toBe(0);
    }
  });

  it('keeps every twinkle phase within [0, 2π)', () => {
    const spec = buildDefaultFar();
    const twoPi = Math.PI * 2;
    for (let i = 0; i < spec.count; i++) {
      const phase = spec.twinklePhases[i] ?? 0;
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(twoPi);
    }
  });
});

describe('buildStarfieldSpec — luminous default (filled in Task 2)', () => {
  it('produces a luminous array initialised to all zeros (Task 2 fills it)', () => {
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count; i++) {
      expect(spec.luminous[i] ?? -1).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run the tests; expect import / typecheck failures**

Run: `pnpm test src/features/scene/services/renderer/starfieldSpec.test.ts`

Expected: the test file fails to compile because the new constants and the new field names don't exist yet. That confirms the test is exercising the new contract.

- [ ] **Step 3: Rewrite the spec module**

Replace the full contents of `src/features/scene/services/renderer/starfieldSpec.ts` with:

```ts
export const STAR_SEED = 0xc0ffee;
export const STAR_SEED_NEAR = (0xc0ffee ^ 0xa1b2c3) >>> 0;

export const STAR_COUNT_FAR = 1700;
export const STAR_COUNT_NEAR = 500;
export const STAR_RADIUS_FAR = 400;
export const STAR_RADIUS_NEAR = 180;

export const PARALLAX_FACTOR_NEAR = 0.6;

export const STAR_SIZE_MIN = 0.6;
export const STAR_SIZE_MAX = 2.4;

export const STAR_BRIGHTNESS_MIN = 0.35;
export const STAR_BRIGHTNESS_MAX = 1;

export const LUMINOUS_PERCENTILE = 0.95;
export const SPIKE_THRESHOLD = 0.7;

export const TWINKLE_FRACTION = 0.14;
export const TWINKLE_BRIGHTNESS_BIAS = 1.0;
export const TWINKLE_SHARP_FRACTION = 0.3;

export const TWINKLE_AMP_SMOOTH_MIN = 0.35;
export const TWINKLE_AMP_SMOOTH_MAX = 0.65;
export const TWINKLE_AMP_SHARP_MIN = 0.5;
export const TWINKLE_AMP_SHARP_MAX = 0.85;
export const TWINKLE_AMP_LUMINOUS_CAP = 0.25;

export const TWINKLE_SPEED_MIN = 0.4;
export const TWINKLE_SPEED_MAX = 2.5;

export type StarfieldSpecParams =
  | { readonly layer: 'far'; readonly seed: number; readonly count: number; readonly radius: number }
  | { readonly layer: 'near'; readonly seed: number; readonly count: number; readonly radius: number };

export type StarfieldSpec = {
  readonly kind: 'starfield_spec';
  readonly layer: 'far' | 'near';
  readonly count: number;
  readonly positions: Float32Array;
  readonly sizes: Float32Array;
  readonly brightness: Float32Array;
  readonly colors: Float32Array;
  readonly luminous: Float32Array;
  readonly twinkleAmps: Float32Array;
  readonly twinkleSpeeds: Float32Array;
  readonly twinkleSharps: Float32Array;
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

type PaletteEntry = { readonly rgb: readonly [number, number, number]; readonly weight: number };
type Palette = ReadonlyArray<PaletteEntry>;

const hex = (h: number): readonly [number, number, number] => [
  ((h >> 16) & 0xff) / 255,
  ((h >> 8) & 0xff) / 255,
  (h & 0xff) / 255,
];

const COOL_BLUE_WHITE = hex(0xbcd0ff);
const NEUTRAL_WHITE = hex(0xeef2ff);
const WARM_WHITE = hex(0xfff4dc);
const ORANGE = hex(0xffc89a);
const DEEP_RED_ORANGE = hex(0xff9272);
const HOT_BLUE = hex(0xa0b8ff);

const PALETTE_BASE: Palette = [
  { rgb: COOL_BLUE_WHITE, weight: 0.15 },
  { rgb: NEUTRAL_WHITE, weight: 0.4 },
  { rgb: WARM_WHITE, weight: 0.25 },
  { rgb: ORANGE, weight: 0.12 },
  { rgb: DEEP_RED_ORANGE, weight: 0.05 },
  { rgb: HOT_BLUE, weight: 0.03 },
];

const PALETTE_DIM: Palette = [
  { rgb: COOL_BLUE_WHITE, weight: 0.15 },
  { rgb: NEUTRAL_WHITE, weight: 0.5 },
  { rgb: WARM_WHITE, weight: 0.3 },
  { rgb: ORANGE, weight: 0.05 },
  { rgb: DEEP_RED_ORANGE, weight: 0 },
  { rgb: HOT_BLUE, weight: 0 },
];

const sampleColor = (palette: Palette, u: number): readonly [number, number, number] => {
  let acc = 0;
  for (const entry of palette) {
    acc += entry.weight;
    if (u <= acc) return entry.rgb;
  }
  const last = palette[palette.length - 1];
  if (last === undefined) throw new Error('palette is empty');
  return last.rgb;
};

export const buildStarfieldSpec = (params: StarfieldSpecParams): StarfieldSpec => {
  const { layer, seed, count, radius } = params;
  const rng = mulberry32(seed);

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const luminous = new Float32Array(count);
  const twinkleAmps = new Float32Array(count);
  const twinkleSpeeds = new Float32Array(count);
  const twinkleSharps = new Float32Array(count);
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

    const palette: Palette = sizeT < 0.3 ? PALETTE_DIM : PALETTE_BASE;
    const colorU = rng();
    const [cr, cg, cb] = sampleColor(palette, colorU);
    colors[i * 3 + 0] = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;

    const isTwinkler = rng() < TWINKLE_FRACTION;
    if (isTwinkler) {
      const isSharp = rng() < TWINKLE_SHARP_FRACTION;
      twinkleSharps[i] = isSharp ? 1 : 0;
      const amp = isSharp
        ? lerp(TWINKLE_AMP_SHARP_MIN, TWINKLE_AMP_SHARP_MAX, rng())
        : lerp(TWINKLE_AMP_SMOOTH_MIN, TWINKLE_AMP_SMOOTH_MAX, rng());
      twinkleAmps[i] = amp;
      twinkleSpeeds[i] = lerp(TWINKLE_SPEED_MIN, TWINKLE_SPEED_MAX, rng());
      twinklePhases[i] = rng() * TWO_PI;
      continue;
    }
    twinkleAmps[i] = 0;
    twinkleSpeeds[i] = 0;
    twinkleSharps[i] = 0;
    twinklePhases[i] = 0;
  }

  return {
    kind: 'starfield_spec',
    layer,
    count,
    positions,
    sizes,
    brightness,
    colors,
    luminous,
    twinkleAmps,
    twinkleSpeeds,
    twinkleSharps,
    twinklePhases,
  };
};
```

Notes:
- The luminous palette is intentionally not declared here — Task 2 owns the luminous tier and the palette it uses, keeping the responsibility split clean.
- Per-star color uses `sizeT` (the brightness rank) to pick `PALETTE_DIM` for the dim 30%; everything else uses `PALETTE_BASE`. Task 2 overrides individual stars' colors when it identifies them as luminous.
- The RNG draws per star are: `u1, u2, sizeT, colorU, isTwinklerU, [isSharpU, ampU, speedU, phaseU]`. The branch consumes 4 or 5 extra draws depending on the twinkler flag. This is deterministic for a fixed seed.

- [ ] **Step 4: Fix the `Starfield.tsx` call site so the codebase still compiles**

Open `src/features/scene/components/Scene/Starfield.tsx` and replace its full contents with:

```tsx
import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import {
  STAR_COUNT_FAR,
  STAR_RADIUS_FAR,
  STAR_SEED,
  buildStarfieldSpec,
} from '../../services/renderer/starfieldSpec';
import { buildStarfieldMaterial } from '../../services/renderer/starfieldMaterial';

const STAR_COLOR = '#cfd9ff';
const TWINKLE_SPEED = 1.6;

export const Starfield = (): JSX.Element => {
  const groupRef = useRef<Group | null>(null);

  const spec = useMemo(
    () =>
      buildStarfieldSpec({
        layer: 'far',
        seed: STAR_SEED,
        count: STAR_COUNT_FAR,
        radius: STAR_RADIUS_FAR,
      }),
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
          <bufferAttribute attach="attributes-aColor" args={[spec.colors, 3]} />
          <bufferAttribute attach="attributes-aLuminous" args={[spec.luminous, 1]} />
          <bufferAttribute attach="attributes-aTwinkleAmp" args={[spec.twinkleAmps, 1]} />
          <bufferAttribute attach="attributes-aTwinkleSpeed" args={[spec.twinkleSpeeds, 1]} />
          <bufferAttribute attach="attributes-aTwinkleSharp" args={[spec.twinkleSharps, 1]} />
          <bufferAttribute attach="attributes-aTwinklePhase" args={[spec.twinklePhases, 1]} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>
    </group>
  );
};
```

Notes:
- The new attribute buffers (`aColor`, `aLuminous`, `aTwinkleSpeed`, `aTwinkleSharp`) are wired now even though the current shader does not consume them. WebGL accepts extra vertex attributes that the shader doesn't read — they're inert until Tasks 3-4 add the shader code. This avoids a Task 5 cascade where every attribute add forces a component edit.
- The `TWINKLE_SPEED = 1.6` constant and the `twinkleSpeed: TWINKLE_SPEED` material argument remain in place — Task 3 deletes them when the material is rewritten. Until then, the existing material API is honoured.

- [ ] **Step 5: Run the spec tests; verify they pass**

Run: `pnpm test src/features/scene/services/renderer/starfieldSpec.test.ts`

Expected: every suite green. If the "speeds seen > 10" sanity check fails, double-check the speed draw uses `lerp` on `rng()` not a constant.

- [ ] **Step 6: Run the full pipeline**

Run: `pnpm check`

Expected: PASS — typecheck, lint, suppressor scan, all tests including `starfieldMaterial.test.ts` (untouched in this task).

- [ ] **Step 7: Commit**

```bash
git add src/features/scene/services/renderer/starfieldSpec.ts src/features/scene/services/renderer/starfieldSpec.test.ts src/features/scene/components/Scene/Starfield.tsx
git commit -m "$(cat <<'EOF'
feat(scene): per-star colour temperature and varied twinkle in starfield spec

Adds 6-tint palette (base + dim variants), per-star twinkle speed in [0.4, 2.5]
rad/s, smooth-vs-sharp curve flag, expanded amplitude ranges (0.35..0.65 smooth,
0.50..0.85 sharp). Twinkle becomes visibly varied instead of a uniform-speed
shared sine. Luminous tier and brightness-rank selection bias arrive in Task 2.
EOF
)"
```

---

## Task 2: Luminous tier + brightness-rank bias on twinkler selection

Add the post-pass that computes the 95th-percentile brightness threshold, fills `luminous[i] ∈ [0, 1]` for stars above it, re-colours those stars from a luminous-biased palette, and clamps their `twinkleAmps[i] ≤ TWINKLE_AMP_LUMINOUS_CAP`. Also tighten twinkler selection in the main loop so probability tracks the per-star brightness rank `sizeT` — dim stars are less likely to twinkle, bright ones more likely, population average exactly `TWINKLE_FRACTION`.

This task touches only `starfieldSpec.ts` and its tests. After this task the spec is complete; Tasks 3-5 consume what it produces.

**Files:**
- Modify: `src/features/scene/services/renderer/starfieldSpec.ts`
- Modify: `src/features/scene/services/renderer/starfieldSpec.test.ts`

- [ ] **Step 1: Write the failing luminous-tier and bias tests**

Append to `src/features/scene/services/renderer/starfieldSpec.test.ts`:

```ts
import {
  LUMINOUS_PERCENTILE,
  SPIKE_THRESHOLD,
  TWINKLE_AMP_LUMINOUS_CAP,
} from './starfieldSpec';

const luminousCap32 = Math.fround(TWINKLE_AMP_LUMINOUS_CAP);

describe('buildStarfieldSpec — luminous tier', () => {
  it('keeps every luminous value within [0, 1]', () => {
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count; i++) {
      const l = spec.luminous[i] ?? -1;
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });

  it('marks roughly (1 - LUMINOUS_PERCENTILE) of stars as luminous (within ±1%)', () => {
    const spec = buildDefaultFar();
    let lit = 0;
    for (let i = 0; i < spec.count; i++) {
      if ((spec.luminous[i] ?? 0) > 0) lit++;
    }
    const expectedFraction = 1 - LUMINOUS_PERCENTILE;
    expect(Math.abs(lit / spec.count - expectedFraction)).toBeLessThan(0.01);
  });

  it('marks between 1% and 2.5% of stars as spike candidates (luminous > SPIKE_THRESHOLD)', () => {
    const spec = buildDefaultFar();
    let spikes = 0;
    for (let i = 0; i < spec.count; i++) {
      if ((spec.luminous[i] ?? 0) > SPIKE_THRESHOLD) spikes++;
    }
    const fraction = spikes / spec.count;
    expect(fraction).toBeGreaterThanOrEqual(0.01);
    expect(fraction).toBeLessThanOrEqual(0.025);
  });

  it('reaches luminous = 1 for the brightest star', () => {
    const spec = buildDefaultFar();
    let maxLum = 0;
    for (let i = 0; i < spec.count; i++) {
      const l = spec.luminous[i] ?? 0;
      if (l > maxLum) maxLum = l;
    }
    expect(maxLum).toBeCloseTo(1, 5);
  });

  it('ties luminous > 0 to the top brightness percentile (every luminous star is at or above the LUMINOUS_PERCENTILE brightness threshold)', () => {
    const spec = buildDefaultFar();
    const sorted = Array.from(spec.brightness).slice().sort((a, b) => a - b);
    const p95 = sorted[Math.floor(LUMINOUS_PERCENTILE * spec.count)] ?? 0;
    for (let i = 0; i < spec.count; i++) {
      if ((spec.luminous[i] ?? 0) > 0) {
        expect(spec.brightness[i] ?? 0).toBeGreaterThanOrEqual(p95);
      }
    }
  });

  it('caps luminous-star twinkle amps at TWINKLE_AMP_LUMINOUS_CAP', () => {
    const spec = buildDefaultFar();
    let checked = 0;
    for (let i = 0; i < spec.count; i++) {
      if ((spec.luminous[i] ?? 0) <= 0) continue;
      expect(spec.twinkleAmps[i] ?? 0).toBeLessThanOrEqual(luminousCap32);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('uses the luminous-biased palette for luminous stars (deep red-orange + hot blue appear more often than in the base distribution)', () => {
    const spec = buildDefaultFar();
    let deepRedOrHotBlue = 0;
    let total = 0;
    for (let i = 0; i < spec.count; i++) {
      if ((spec.luminous[i] ?? 0) <= 0) continue;
      total++;
      const c = colorAt(spec, i);
      if (colorMatchesBucket(c, PALETTE_HEXES[4] ?? [0, 0, 0])) deepRedOrHotBlue++;
      if (colorMatchesBucket(c, PALETTE_HEXES[5] ?? [0, 0, 0])) deepRedOrHotBlue++;
    }
    expect(total).toBeGreaterThan(0);
    // Base palette weights for deep-red + hot-blue sum to 0.08. Luminous palette
    // weights sum to 0.41. With ±0.1 tolerance the observed fraction must clear
    // 0.25 — far above what the base palette would yield.
    expect(deepRedOrHotBlue / total).toBeGreaterThan(0.25);
  });
});

describe('buildStarfieldSpec — brightness-rank bias on twinkler selection', () => {
  it('biases twinkler selection toward brighter stars (mean brightness of twinklers > mean brightness of all stars by a clear margin)', () => {
    const spec = buildDefaultFar();
    let twinklerSum = 0;
    let twinklerCount = 0;
    let totalSum = 0;
    for (let i = 0; i < spec.count; i++) {
      const b = spec.brightness[i] ?? 0;
      totalSum += b;
      if ((spec.twinkleAmps[i] ?? 0) > 0) {
        twinklerSum += b;
        twinklerCount++;
      }
    }
    expect(twinklerCount).toBeGreaterThan(0);
    const twinklerMean = twinklerSum / twinklerCount;
    const totalMean = totalSum / spec.count;
    expect(twinklerMean).toBeGreaterThan(totalMean);
    // Sanity: with TWINKLE_BRIGHTNESS_BIAS = 1.0 and STAR_COUNT_FAR samples the
    // gap should be at least 5% of the total mean.
    expect(twinklerMean - totalMean).toBeGreaterThan(totalMean * 0.05);
  });

  it('keeps the population twinkler fraction in [0.12, 0.17] (binomial tolerance — bias preserves the population mean of TWINKLE_FRACTION)', () => {
    const spec = buildDefaultFar();
    let twinklers = 0;
    for (let i = 0; i < spec.count; i++) {
      if ((spec.twinkleAmps[i] ?? 0) > 0) twinklers++;
    }
    const fraction = twinklers / spec.count;
    expect(fraction).toBeGreaterThanOrEqual(0.12);
    expect(fraction).toBeLessThanOrEqual(0.17);
  });
});
```

Also delete from the file the earlier "produces a luminous array initialised to all zeros" test added in Task 1 — it is contradicted by the new behaviour.

- [ ] **Step 2: Run the tests; verify the new luminous and bias suites fail**

Run: `pnpm test src/features/scene/services/renderer/starfieldSpec.test.ts`

Expected: the luminous suite fails because every `luminous[i] = 0`. The bias suite *may* pass coincidentally — without the bias, the mean brightness of a random 14% subset is statistically close to the population mean, so the "> totalMean by 5%" assertion will usually fail on a 1700-sample population. Confirm at least *one* assertion in each of the two new suites fails before proceeding.

- [ ] **Step 3: Add the brightness-rank bias to the twinkler selection in the main loop**

In `src/features/scene/services/renderer/starfieldSpec.ts`, find this line inside the per-star loop:

```ts
const isTwinkler = rng() < TWINKLE_FRACTION;
```

Replace it with:

```ts
const pBase = TWINKLE_FRACTION * (1 + TWINKLE_BRIGHTNESS_BIAS * (sizeT - 0.5));
const isTwinkler = rng() < pBase;
```

Notes:
- `sizeT` is uniform on `[0, 1]` by construction (it's the per-star rng draw used to shape size, and because brightness is monotone in size, `sizeT` doubles as the brightness rank).
- `pBase` ranges `[0.07, 0.21]` and averages exactly `TWINKLE_FRACTION = 0.14` because `E[sizeT - 0.5] = 0`.
- This is a one-line change; no RNG draws are added or removed, so the determinism of subsequent stars is preserved.

- [ ] **Step 4: Add the luminous-tier post-pass**

In `src/features/scene/services/renderer/starfieldSpec.ts`, add the luminous palette next to the existing palette declarations:

```ts
const PALETTE_LUMINOUS: Palette = [
  { rgb: COOL_BLUE_WHITE, weight: 0.15 },
  { rgb: NEUTRAL_WHITE, weight: 0.2 },
  { rgb: WARM_WHITE, weight: 0.12 },
  { rgb: ORANGE, weight: 0.12 },
  { rgb: DEEP_RED_ORANGE, weight: 0.15 },
  { rgb: HOT_BLUE, weight: 0.26 },
];
```

Then, after the main `for (let i = 0; i < count; i++)` loop and before the `return` statement, add:

```ts
// Luminous tier: top (1 - LUMINOUS_PERCENTILE) of stars by brightness get a
// 0..1 weight that drives in-shader halo size and (above SPIKE_THRESHOLD)
// diffraction spikes. The threshold is computed from the sorted brightness
// array so the test contract (every luminous star ≥ p95) holds exactly.
const sortedBrightness = Float32Array.from(brightness).slice().sort();
const thresholdIdx = Math.floor(LUMINOUS_PERCENTILE * count);
const pThreshold = sortedBrightness[thresholdIdx] ?? 0;
const pMax = sortedBrightness[count - 1] ?? pThreshold;
const lumRange = Math.max(pMax - pThreshold, 1e-6);

for (let i = 0; i < count; i++) {
  const b = brightness[i] ?? 0;
  if (b < pThreshold) continue;
  const l = Math.min(Math.max((b - pThreshold) / lumRange, 0), 1);
  luminous[i] = l;
}

// Re-colour luminous stars with the luminous-biased palette. A separate RNG
// stream keeps the main-loop RNG draws stable across populations.
const recolorRng = mulberry32((seed ^ 0x10000000) >>> 0);
for (let i = 0; i < count; i++) {
  if ((luminous[i] ?? 0) <= 0) continue;
  const [cr, cg, cb] = sampleColor(PALETTE_LUMINOUS, recolorRng());
  colors[i * 3 + 0] = cr;
  colors[i * 3 + 1] = cg;
  colors[i * 3 + 2] = cb;
}

// Luminous stars twinkle gently or not at all — the cinematic standouts read
// as rock-steady. Clamp pre-existing amps; don't promote zero amps.
for (let i = 0; i < count; i++) {
  if ((luminous[i] ?? 0) <= 0) continue;
  const amp = twinkleAmps[i] ?? 0;
  if (amp <= TWINKLE_AMP_LUMINOUS_CAP) continue;
  twinkleAmps[i] = TWINKLE_AMP_LUMINOUS_CAP;
}
```

- [ ] **Step 5: Run the tests; verify the new suites pass**

Run: `pnpm test src/features/scene/services/renderer/starfieldSpec.test.ts`

Expected: all suites green. If the "marks roughly (1 - LUMINOUS_PERCENTILE) of stars as luminous" assertion fails by a hair, the threshold index calculation may be off by one — `Math.floor(0.95 * 1700) = 1615`, leaving `1700 - 1615 = 85` stars above-or-at the threshold, which is the correct 5%.

- [ ] **Step 6: Run the full pipeline**

Run: `pnpm check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/scene/services/renderer/starfieldSpec.ts src/features/scene/services/renderer/starfieldSpec.test.ts
git commit -m "$(cat <<'EOF'
feat(scene): luminous tier + brightness-rank bias on starfield twinkler selection

Top 5% of stars by brightness get a 0..1 luminous weight (Task 4 drives the
in-shader halo + spike from this), re-coloured from a hot-blue / deep-red biased
palette, and amp-clamped to ≤ 0.25 so the cinematic standouts feel rock-steady.
Twinkler selection probability tracks brightness rank — 7% at the dim end, 21%
at the bright end, population mean exactly TWINKLE_FRACTION.
EOF
)"
```

---

## Task 3: Material — new attributes, new uniforms, vertex shader twinkle math

Replace `starfieldMaterial.ts` to consume the per-star `aColor`, `aLuminous`, `aTwinkleSpeed`, `aTwinkleSharp` attributes, drop the now-obsolete `twinkleSpeed` parameter and `uTwinkleSpeed` uniform, expose `uHaloSizeBoost` / `uHaloStrength` / `uSpikeStrength`, and rewrite the vertex shader to blend smooth and sharp twinkle curves and enlarge `gl_PointSize` for luminous stars. The fragment shader is updated to multiply by `vColor` but the halo / spike branches arrive in Task 4.

**Files:**
- Modify: `src/features/scene/services/renderer/starfieldMaterial.ts`
- Modify: `src/features/scene/services/renderer/starfieldMaterial.test.ts`
- Modify: `src/features/scene/components/Scene/Starfield.tsx` (drop the `twinkleSpeed` arg)

- [ ] **Step 1: Rewrite the failing material tests**

Replace the contents of `src/features/scene/services/renderer/starfieldMaterial.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { AdditiveBlending, Color, ShaderMaterial } from 'three';
import { buildStarfieldMaterial, type StarfieldMaterialParams } from './starfieldMaterial';

const PARAMS: StarfieldMaterialParams = {
  color: '#cfd9ff',
};

const getUniform = (material: ShaderMaterial, key: string): { readonly value: unknown } => {
  const u = material.uniforms[key];
  if (u === undefined) throw new Error(`uniform ${key} missing`);
  return u;
};

describe('buildStarfieldMaterial — instance + flags', () => {
  it('returns a ShaderMaterial with transparent additive blending and no depth write', () => {
    const material = buildStarfieldMaterial(PARAMS);
    expect(material).toBeInstanceOf(ShaderMaterial);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(AdditiveBlending);
  });
});

describe('buildStarfieldMaterial — uniforms', () => {
  it('exposes uTime initialised to zero', () => {
    expect(getUniform(buildStarfieldMaterial(PARAMS), 'uTime').value).toBe(0);
  });

  it('exposes uColor as a three.Color matching the input hex', () => {
    const value: unknown = getUniform(buildStarfieldMaterial(PARAMS), 'uColor').value;
    if (!(value instanceof Color)) throw new Error('uColor.value is not a Color');
    const expected = new Color('#cfd9ff');
    expect(value.r).toBeCloseTo(expected.r, 5);
    expect(value.g).toBeCloseTo(expected.g, 5);
    expect(value.b).toBeCloseTo(expected.b, 5);
  });

  it('exposes uPixelRatio with a positive number', () => {
    const value: unknown = getUniform(buildStarfieldMaterial(PARAMS), 'uPixelRatio').value;
    if (typeof value !== 'number') throw new Error('uPixelRatio.value is not a number');
    expect(value).toBeGreaterThan(0);
  });

  it('exposes uHaloSizeBoost, uHaloStrength, uSpikeStrength with positive defaults', () => {
    const material = buildStarfieldMaterial(PARAMS);
    for (const key of ['uHaloSizeBoost', 'uHaloStrength', 'uSpikeStrength'] as const) {
      const value: unknown = getUniform(material, key).value;
      if (typeof value !== 'number') throw new Error(`${key}.value is not a number`);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('does not expose uTwinkleSpeed (replaced by per-star aTwinkleSpeed)', () => {
    expect(buildStarfieldMaterial(PARAMS).uniforms['uTwinkleSpeed']).toBeUndefined();
  });
});

describe('buildStarfieldMaterial — shader source', () => {
  it('references the new per-star attributes in the vertex shader', () => {
    const src = buildStarfieldMaterial(PARAMS).vertexShader;
    expect(src).toContain('aColor');
    expect(src).toContain('aLuminous');
    expect(src).toContain('aTwinkleSpeed');
    expect(src).toContain('aTwinkleSharp');
    expect(src).toContain('aSize');
    expect(src).toContain('aBrightness');
    expect(src).toContain('aTwinkleAmp');
    expect(src).toContain('aTwinklePhase');
  });

  it('blends smooth and sharp twinkle curves via aTwinkleSharp', () => {
    const src = buildStarfieldMaterial(PARAMS).vertexShader;
    expect(src).toMatch(/mix\(\s*[a-zA-Z_]+\s*,\s*[a-zA-Z_]+\s*,\s*aTwinkleSharp\s*\)/);
  });

  it('enlarges gl_PointSize for luminous stars via uHaloSizeBoost', () => {
    const src = buildStarfieldMaterial(PARAMS).vertexShader;
    expect(src).toContain('uHaloSizeBoost');
    expect(src).toMatch(/gl_PointSize\s*=[^;]*aLuminous\s*\*\s*uHaloSizeBoost/);
  });

  it('varies vColor, vLuminous, vAlpha out of the vertex shader', () => {
    const src = buildStarfieldMaterial(PARAMS).vertexShader;
    expect(src).toContain('vColor');
    expect(src).toContain('vLuminous');
    expect(src).toContain('vAlpha');
  });

  it('reads vColor and vAlpha in the fragment shader (vLuminous is consumed in Task 4)', () => {
    const src = buildStarfieldMaterial(PARAMS).fragmentShader;
    expect(src).toContain('vColor');
    expect(src).toContain('vAlpha');
  });

  it('multiplies fragment colour by vColor so per-star tint reaches the output', () => {
    const src = buildStarfieldMaterial(PARAMS).fragmentShader;
    expect(src).toMatch(/uColor\s*\*\s*vColor|vColor\s*\*\s*uColor/);
  });
});
```

- [ ] **Step 2: Run material tests; verify they fail**

Run: `pnpm test src/features/scene/services/renderer/starfieldMaterial.test.ts`

Expected: the test file fails to compile because `StarfieldMaterialParams` still requires `twinkleSpeed`. Once that field is removed in Step 3, the new shader-source and uniform assertions will fail at runtime.

- [ ] **Step 3: Rewrite the material module**

Replace the full contents of `src/features/scene/services/renderer/starfieldMaterial.ts` with:

```ts
import { AdditiveBlending, Color, ShaderMaterial } from 'three';

export type StarfieldMaterialParams = {
  readonly color: string;
};

const DEFAULT_HALO_SIZE_BOOST = 14.0;
const DEFAULT_HALO_STRENGTH = 0.55;
const DEFAULT_SPIKE_STRENGTH = 0.45;

const VERTEX_SHADER = `
attribute float aSize;
attribute float aBrightness;
attribute float aTwinkleAmp;
attribute float aTwinkleSpeed;
attribute float aTwinkleSharp;
attribute float aTwinklePhase;
attribute vec3 aColor;
attribute float aLuminous;

uniform float uTime;
uniform float uPixelRatio;
uniform float uHaloSizeBoost;

varying float vAlpha;
varying vec3 vColor;
varying float vLuminous;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  float wave = sin(uTime * aTwinkleSpeed + aTwinklePhase);
  float normalized = 0.5 + 0.5 * wave;
  float sharpened = pow(normalized, 6.0);
  float shaped = mix(normalized, sharpened, aTwinkleSharp);
  float twinkle = 1.0 - aTwinkleAmp + aTwinkleAmp * shaped;

  vAlpha = aBrightness * twinkle;
  vColor = aColor;
  vLuminous = aLuminous;

  float baseSize = aSize * uPixelRatio;
  gl_PointSize = baseSize + aLuminous * uHaloSizeBoost;
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColor;

varying float vAlpha;
varying vec3 vColor;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float core = smoothstep(0.25, 0.0, r2);
  gl_FragColor = vec4(uColor * vColor, vAlpha * core);
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
      uColor: { value: new Color(params.color) },
      uPixelRatio: { value: readDevicePixelRatio() },
      uHaloSizeBoost: { value: DEFAULT_HALO_SIZE_BOOST },
      uHaloStrength: { value: DEFAULT_HALO_STRENGTH },
      uSpikeStrength: { value: DEFAULT_SPIKE_STRENGTH },
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
- The vertex shader writes `vLuminous = aLuminous;` even though no fragment shader reads it yet. Most GLSL drivers silently optimise this away; the line stays here because Task 4 will start reading `vLuminous` in the fragment shader and the vertex-side write must already exist.
- `uHaloStrength` and `uSpikeStrength` are declared on the material but not referenced in the fragment shader yet. Three.js leaves unused uniforms in place silently. Task 4 wires them into the fragment.

- [ ] **Step 4: Update the component to drop the `twinkleSpeed` argument**

In `src/features/scene/components/Scene/Starfield.tsx`, replace these two blocks:

```tsx
const STAR_COLOR = '#cfd9ff';
const TWINKLE_SPEED = 1.6;
```

with:

```tsx
const STAR_COLOR = '#cfd9ff';
```

And replace:

```tsx
const material = useMemo(
  () => buildStarfieldMaterial({ color: STAR_COLOR, twinkleSpeed: TWINKLE_SPEED }),
  [],
);
```

with:

```tsx
const material = useMemo(() => buildStarfieldMaterial({ color: STAR_COLOR }), []);
```

- [ ] **Step 5: Run the material tests; verify they pass**

Run: `pnpm test src/features/scene/services/renderer/starfieldMaterial.test.ts`

Expected: all suites green.

- [ ] **Step 6: Run the full pipeline**

Run: `pnpm check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/scene/services/renderer/starfieldMaterial.ts src/features/scene/services/renderer/starfieldMaterial.test.ts src/features/scene/components/Scene/Starfield.tsx
git commit -m "$(cat <<'EOF'
feat(scene): starfield material — per-star attributes, per-star twinkle math

Drops uTwinkleSpeed in favour of per-star aTwinkleSpeed. Vertex shader blends
smooth and sharp twinkle curves via aTwinkleSharp, and enlarges gl_PointSize
for luminous stars so Task 4 has room to draw halo + spike fragments. New
uniforms uHaloSizeBoost / uHaloStrength / uSpikeStrength land here; the latter
two are consumed in Task 4.
EOF
)"
```

---

## Task 4: Fragment shader — halo and diffraction spike branches

Replace the fragment shader's no-op `vLuminous * 0.0` placeholder with the real halo and spike contributions. The halo contribution is multiplied by `vLuminous`, collapsing to zero for the 95% non-luminous fragments. The spike contribution is multiplied by `step(0.7, vLuminous)`, lighting up only the top ~1.5%.

**Files:**
- Modify: `src/features/scene/services/renderer/starfieldMaterial.ts`
- Modify: `src/features/scene/services/renderer/starfieldMaterial.test.ts`

- [ ] **Step 1: Write the failing fragment tests**

Append to `src/features/scene/services/renderer/starfieldMaterial.test.ts`:

```ts
describe('buildStarfieldMaterial — halo + spike fragment paths', () => {
  it('contains a halo contribution gated by vLuminous and uHaloStrength', () => {
    const src = buildStarfieldMaterial(PARAMS).fragmentShader;
    expect(src).toContain('uHaloStrength');
    expect(src).toMatch(/halo\s*=[^;]*vLuminous/);
  });

  it('contains a diffraction-spike contribution gated by the 0.7 luminous threshold', () => {
    const src = buildStarfieldMaterial(PARAMS).fragmentShader;
    expect(src).toContain('uSpikeStrength');
    expect(src).toMatch(/step\s*\(\s*0\.7/);
  });

  it('combines core + halo + spike into the final fragment intensity', () => {
    const src = buildStarfieldMaterial(PARAMS).fragmentShader;
    expect(src).toMatch(/core\s*\+\s*halo\s*\+\s*spike|core\s*\+\s*spike\s*\+\s*halo|halo\s*\+\s*core\s*\+\s*spike|spike\s*\+\s*halo\s*\+\s*core|spike\s*\+\s*core\s*\+\s*halo|halo\s*\+\s*spike\s*\+\s*core/);
  });
});
```

- [ ] **Step 2: Run material tests; verify the new suite fails**

Run: `pnpm test src/features/scene/services/renderer/starfieldMaterial.test.ts`

Expected: the three new assertions fail — current fragment shader has the placeholder `keep = vLuminous * 0.0` but no halo, spike, or combined intensity.

- [ ] **Step 3: Replace the fragment shader**

In `src/features/scene/services/renderer/starfieldMaterial.ts`, replace the `FRAGMENT_SHADER` template literal with:

```ts
const FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uHaloStrength;
uniform float uSpikeStrength;

varying float vAlpha;
varying vec3 vColor;
varying float vLuminous;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float r = sqrt(r2);

  float core = smoothstep(0.25, 0.0, r2);

  float haloOuter = smoothstep(0.5, 0.0, r);
  float haloInner = smoothstep(0.0, 0.05, r);
  float halo = uHaloStrength * vLuminous * haloOuter * haloInner;

  float spikeMask = step(0.7, vLuminous);
  float spikeStrength = (vLuminous - 0.7) / 0.3;
  float armX = smoothstep(0.04, 0.0, abs(d.y)) * smoothstep(0.5, 0.0, abs(d.x));
  float armY = smoothstep(0.04, 0.0, abs(d.x)) * smoothstep(0.5, 0.0, abs(d.y));
  float spikeFalloff = smoothstep(0.5, 0.0, r);
  float spike = spikeMask * uSpikeStrength * spikeStrength * max(armX, armY) * spikeFalloff;

  float intensity = core + halo + spike;
  gl_FragColor = vec4(uColor * vColor, vAlpha * intensity);
}
`;
```

Notes:
- For non-luminous fragments (`vLuminous = 0`), `halo = 0` (multiplied by zero), `spikeMask = 0` (`step(0.7, 0)`), so `spike = 0`. The fragment cost is the same handful of multiplications regardless of luminous status.
- `step()` is branchless. The `vLuminous > 0.7` gate runs as a uniform mask without divergent flow control.
- Spike arms use `smoothstep(0.04, 0.0, abs(d.y))` for the horizontal arm — narrow band on the y-axis, wide along x. The cross is the `max` of both arms.

- [ ] **Step 4: Run material tests; verify they pass**

Run: `pnpm test src/features/scene/services/renderer/starfieldMaterial.test.ts`

Expected: all suites green.

- [ ] **Step 5: Run the full pipeline**

Run: `pnpm check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/scene/services/renderer/starfieldMaterial.ts src/features/scene/services/renderer/starfieldMaterial.test.ts
git commit -m "$(cat <<'EOF'
feat(scene): in-shader bloom halos + diffraction spikes for luminous stars

Halo contribution rides on the enlarged point sprite — multiplied by vLuminous,
so the 95% non-luminous fragments contribute zero. Diffraction cross is gated
by step(0.7, vLuminous) and reaches the top ~1.5%. No postprocessing pass; the
combined cost is a few extra fragment ALU ops on the brightest 5% of points.
EOF
)"
```

---

## Task 5: Component — two layers and parallax

Update `Starfield.tsx` to render two layers: the existing far layer (1700 stars, fully camera-locked) plus a new near layer (500 stars, drifting at `0.6×` camera position for parallax). Both layers share the same `ShaderMaterial`.

**Files:**
- Modify: `src/features/scene/components/Scene/Starfield.tsx`

- [ ] **Step 1: Replace the component**

Replace the full contents of `src/features/scene/components/Scene/Starfield.tsx` with:

```tsx
import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import {
  PARALLAX_FACTOR_NEAR,
  STAR_COUNT_FAR,
  STAR_COUNT_NEAR,
  STAR_RADIUS_FAR,
  STAR_RADIUS_NEAR,
  STAR_SEED,
  STAR_SEED_NEAR,
  buildStarfieldSpec,
  type StarfieldSpec,
} from '../../services/renderer/starfieldSpec';
import { buildStarfieldMaterial } from '../../services/renderer/starfieldMaterial';

const STAR_COLOR = '#cfd9ff';

type StarLayerProps = {
  readonly spec: StarfieldSpec;
  readonly groupRef: RefObject<Group | null>;
  readonly material: ReturnType<typeof buildStarfieldMaterial>;
};

const StarLayer = ({ spec, groupRef, material }: StarLayerProps): JSX.Element => (
  <group ref={groupRef}>
    <points renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[spec.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[spec.sizes, 1]} />
        <bufferAttribute attach="attributes-aBrightness" args={[spec.brightness, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[spec.colors, 3]} />
        <bufferAttribute attach="attributes-aLuminous" args={[spec.luminous, 1]} />
        <bufferAttribute attach="attributes-aTwinkleAmp" args={[spec.twinkleAmps, 1]} />
        <bufferAttribute attach="attributes-aTwinkleSpeed" args={[spec.twinkleSpeeds, 1]} />
        <bufferAttribute attach="attributes-aTwinkleSharp" args={[spec.twinkleSharps, 1]} />
        <bufferAttribute attach="attributes-aTwinklePhase" args={[spec.twinklePhases, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  </group>
);

export const Starfield = (): JSX.Element => {
  const farGroupRef = useRef<Group | null>(null);
  const nearGroupRef = useRef<Group | null>(null);

  const farSpec = useMemo(
    () =>
      buildStarfieldSpec({
        layer: 'far',
        seed: STAR_SEED,
        count: STAR_COUNT_FAR,
        radius: STAR_RADIUS_FAR,
      }),
    [],
  );
  const nearSpec = useMemo(
    () =>
      buildStarfieldSpec({
        layer: 'near',
        seed: STAR_SEED_NEAR,
        count: STAR_COUNT_NEAR,
        radius: STAR_RADIUS_NEAR,
      }),
    [],
  );

  const material = useMemo(() => buildStarfieldMaterial({ color: STAR_COLOR }), []);

  useFrame((state, delta) => {
    const farGroup = farGroupRef.current;
    const nearGroup = nearGroupRef.current;
    if (farGroup !== null) farGroup.position.copy(state.camera.position);
    if (nearGroup !== null)
      nearGroup.position.copy(state.camera.position).multiplyScalar(PARALLAX_FACTOR_NEAR);
    const uTime = material.uniforms['uTime'];
    if (uTime === undefined) return;
    uTime.value += delta;
  });

  return (
    <>
      <StarLayer spec={farSpec} groupRef={farGroupRef} material={material} />
      <StarLayer spec={nearSpec} groupRef={nearGroupRef} material={material} />
    </>
  );
};
```

Notes:
- `StarLayer` is a file-local sub-component that absorbs the duplication of the `<group>` + `<points>` + nine `<bufferAttribute>` block. It does not leak outside this file.
- The same `material` instance is passed to both layers. Because `<primitive object={material} attach="material" />` reuses whatever object reference it receives, both `<points>` meshes share the material — one shader compile, one set of uniform updates per frame.
- Near group's position is `state.camera.position * PARALLAX_FACTOR_NEAR`. With factor 0.6, the near layer drifts at 40% of camera motion, producing the parallax cue.

- [ ] **Step 2: Run the full pipeline**

Run: `pnpm check`

Expected: PASS.

- [ ] **Step 3: Manual smoke test in the dev server**

Run: `pnpm dev`

Then in a browser:
1. Open the app.
2. Confirm stars are visible across the dome.
3. Confirm visible colour variety — some warm-yellow, some cool-blue, occasional deep red and bright blue.
4. Fly the ship; confirm near-layer stars visibly shift relative to far-layer stars (parallax).
5. Watch the sky at rest for ~5 seconds; confirm visible twinkling — multiple stars perceptibly breathing or flickering at different rates.
6. Scan for the brightest stars; confirm soft halo glow rings.
7. Confirm the top 1-2 stars show a visible four-point cross.
8. Fly past a planet; confirm the planet correctly occludes stars behind it.

If anything looks wrong, do not commit. Common diagnoses:
- No visible twinkle → check `aTwinkleSpeed` is non-zero for twinklers (`spec.twinkleSpeeds`) and `uTime` is incrementing (browser devtools: `material.uniforms.uTime.value` should grow over time).
- Halos invisible → bump `DEFAULT_HALO_STRENGTH` in the material (try 0.75) or `DEFAULT_HALO_SIZE_BOOST` (try 18.0).
- Spikes too dim → bump `DEFAULT_SPIKE_STRENGTH` (try 0.6).
- Near layer looks identical to far layer → confirm `PARALLAX_FACTOR_NEAR` is being applied and both layers receive distinct group refs.

- [ ] **Step 4: Commit**

```bash
git add src/features/scene/components/Scene/Starfield.tsx
git commit -m "$(cat <<'EOF'
feat(scene): two-layer parallax starfield sharing one AAA material

Far layer (1700 stars at radius 400) is fully camera-locked. Near layer (500
stars at radius 180) drifts at 0.6× camera position to produce parallax during
ship motion. One ShaderMaterial drives both layers via per-star attributes.
EOF
)"
```

---

## Task 6: Final verification

End-to-end check that the full pipeline passes and the visual goals are met. No code changes.

**Files:** none

- [ ] **Step 1: Run the full check pipeline**

Run: `pnpm check`

Expected: PASS — typecheck, oxlint, suppressor scan, all tests green.

- [ ] **Step 2: Run the dev server and walk the spec's manual verification checklist**

Run: `pnpm dev`

Walk through the *Manual verification* section of `docs/superpowers/specs/2026-05-21-starfield-aaa-design.md` in full:
- Colour variety obvious within 2 seconds.
- Twinkling unmistakable within 5 seconds.
- Mix of slow throbs and quick flickers visible.
- A handful of bright halo'd stars findable on a single screen.
- One or two stars show the diffraction cross.
- Parallax visible during ship motion.
- Planets correctly occlude stars; comet trails read cleanly.

- [ ] **Step 3: Performance spot-check**

In Chrome devtools Performance tab, record 5 seconds of idle scene and 5 seconds of ship motion. Confirm:
- No measurable frame-time delta vs the pre-upgrade branch (within noise).
- No unexpected long tasks attributable to starfield code.

If everything passes, the feature ships. No commit needed.

---

## Notes for the executing engineer

- **TDD discipline:** Every code-bearing task in this plan opens with a failing test. Do not skip running it after it's written — confirming the *failure mode* is the test. A test that passes before the implementation is written is a broken test.
- **Iron Law 4 (no defensive cruft):** This codebase forbids `!`, `as` casts on lookups, `?? default` on lookup-shaped expressions, and `eslint-disable` comments. The `pnpm lint:suppressors` step in `pnpm check` will reject the commit if you add any. If you reach for one, the model is wrong — split a type, add a discriminated variant, or move the responsibility.
- **`?? 0` on `Float32Array[i]`:** The existing test code uses this pattern (`spec.positions[i] ?? 0`). The repo's suppressor scan permits it for typed-array index access. Do not "fix" it.
- **Float32 precision in test bounds:** When asserting that a `Float32Array` value is `>= 0.35`, use `Math.fround(0.35)` as the comparison threshold. The plan's tests follow this pattern.
- **Determinism:** Both layers use deterministic seeds. The test suite relies on identical arrays across calls. Do not introduce `Math.random()` or wall-clock time into the spec builder.
- **Each task ships independently:** After Task 1 alone, the starfield is already visibly improved (colour + twinkle variety). After Task 2, the spec is complete. Tasks 3-5 land visual effects in the material and component. No task leaves the codebase in a half-done state.
- **Spec is the source of truth:** If any step here conflicts with `docs/superpowers/specs/2026-05-21-starfield-aaa-design.md`, the spec wins. Pause and reconcile before writing code.
