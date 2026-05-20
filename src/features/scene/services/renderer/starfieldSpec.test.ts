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

// Values stored in Float32Array are quantized to float32 precision. Compare
// against Math.fround(bound) so the assertion matches the storage precision
// rather than the float64 source literal (e.g. 0.35 is unrepresentable in
// float32 and rounds to ~0.34999999, which would falsely fail a strict
// `>= 0.35` check against the float64 constant).
const sizeMin32 = Math.fround(STAR_SIZE_MIN);
const sizeMax32 = Math.fround(STAR_SIZE_MAX);
const brightnessMin32 = Math.fround(STAR_BRIGHTNESS_MIN);
const brightnessMax32 = Math.fround(STAR_BRIGHTNESS_MAX);
const twinkleAmpMin32 = Math.fround(TWINKLE_AMP_MIN);
const twinkleAmpMax32 = Math.fround(TWINKLE_AMP_MAX);

describe('buildStarfieldSpec — size and brightness ranges', () => {
  it('keeps every size within [STAR_SIZE_MIN, STAR_SIZE_MAX]', () => {
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS });
    for (let i = 0; i < spec.count; i++) {
      const s = spec.sizes[i] ?? 0;
      expect(s).toBeGreaterThanOrEqual(sizeMin32);
      expect(s).toBeLessThanOrEqual(sizeMax32);
    }
  });

  it('keeps every brightness within [STAR_BRIGHTNESS_MIN, STAR_BRIGHTNESS_MAX]', () => {
    const spec = buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS });
    for (let i = 0; i < spec.count; i++) {
      const b = spec.brightness[i] ?? 0;
      expect(b).toBeGreaterThanOrEqual(brightnessMin32);
      expect(b).toBeLessThanOrEqual(brightnessMax32);
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
      expect(amp).toBeGreaterThanOrEqual(twinkleAmpMin32);
      expect(amp).toBeLessThanOrEqual(twinkleAmpMax32);
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
