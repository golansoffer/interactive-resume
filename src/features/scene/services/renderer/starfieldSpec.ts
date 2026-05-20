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
