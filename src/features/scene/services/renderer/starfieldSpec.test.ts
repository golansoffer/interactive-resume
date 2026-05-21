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
  [0xbc / 255, 0xd0 / 255, 0xff / 255],
  [0xee / 255, 0xf2 / 255, 0xff / 255],
  [0xff / 255, 0xf4 / 255, 0xdc / 255],
  [0xff / 255, 0xc8 / 255, 0x9a / 255],
  [0xff / 255, 0x92 / 255, 0x72 / 255],
  [0xa0 / 255, 0xb8 / 255, 0xff / 255],
];

const colorAt = (
  spec: ReturnType<typeof buildStarfieldSpec>,
  i: number,
): readonly [number, number, number] => [
  spec.colors[i * 3 + 0] ?? 0,
  spec.colors[i * 3 + 1] ?? 0,
  spec.colors[i * 3 + 2] ?? 0,
];

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
    const sorted = Array.from(spec.brightness).sort((a, b) => a - b);
    const p30 = sorted[Math.floor(0.3 * spec.count)] ?? 0;
    const p95 = sorted[Math.floor(0.95 * spec.count)] ?? 0;
    const counts: number[] = [0, 0, 0, 0, 0, 0];
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
    const sorted = Array.from(spec.brightness).sort((a, b) => a - b);
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
    for (let i = 0; i < spec.count; i++) {
      const phase = spec.twinklePhases[i] ?? 0;
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(Math.PI * 2);
    }
  });
});

describe('buildStarfieldSpec — luminous default', () => {
  it('produces a luminous array initialised to all zeros', () => {
    const spec = buildDefaultFar();
    for (let i = 0; i < spec.count; i++) {
      expect(spec.luminous[i] ?? -1).toBe(0);
    }
  });
});
