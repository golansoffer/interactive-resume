export const STAR_SEED = 0xc0ffee;
export const STAR_SEED_NEAR = (0xc0ffee ^ 0xa1b2c3) >>> 0;

export const STAR_COUNT_FAR = 2500;
export const STAR_COUNT_NEAR = 800;
export const STAR_RADIUS_FAR = 400;
export const STAR_RADIUS_NEAR = 180;

export const PARALLAX_FACTOR_NEAR = 0.6;

export const STAR_SIZE_MIN = 0.6;
export const STAR_SIZE_MAX = 1.6;

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

export type StarfieldSpecParams = {
  readonly layer: 'far' | 'near';
  readonly seed: number;
  readonly count: number;
  readonly radius: number;
};

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
type Palette = readonly [PaletteEntry, ...PaletteEntry[]];

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

const PALETTE_LUMINOUS: Palette = [
  { rgb: COOL_BLUE_WHITE, weight: 0.15 },
  { rgb: NEUTRAL_WHITE, weight: 0.2 },
  { rgb: WARM_WHITE, weight: 0.12 },
  { rgb: ORANGE, weight: 0.12 },
  { rgb: DEEP_RED_ORANGE, weight: 0.15 },
  { rgb: HOT_BLUE, weight: 0.26 },
];

const sampleColor = (palette: Palette, u: number): readonly [number, number, number] => {
  let acc = 0;
  let last: PaletteEntry = palette[0];
  for (const entry of palette) {
    last = entry;
    acc += entry.weight;
    if (u <= acc) return entry.rgb;
  }
  return last.rgb;
};

type StarValues = {
  readonly position: readonly [number, number, number];
  readonly size: number;
  readonly brightness: number;
  readonly color: readonly [number, number, number];
  readonly twinkleAmp: number;
  readonly twinkleSpeed: number;
  readonly twinkleSharp: 0 | 1;
  readonly twinklePhase: number;
};

const computeTwinkler = (rng: Rng): Pick<StarValues, 'twinkleAmp' | 'twinkleSpeed' | 'twinkleSharp' | 'twinklePhase'> => {
  const isSharp = rng() < TWINKLE_SHARP_FRACTION;
  return {
    twinkleSharp: isSharp ? 1 : 0,
    twinkleAmp: isSharp
      ? lerp(TWINKLE_AMP_SHARP_MIN, TWINKLE_AMP_SHARP_MAX, rng())
      : lerp(TWINKLE_AMP_SMOOTH_MIN, TWINKLE_AMP_SMOOTH_MAX, rng()),
    twinkleSpeed: lerp(TWINKLE_SPEED_MIN, TWINKLE_SPEED_MAX, rng()),
    twinklePhase: rng() * TWO_PI,
  };
};

const NO_TWINKLE = {
  twinkleAmp: 0,
  twinkleSpeed: 0,
  twinkleSharp: 0 as const,
  twinklePhase: 0,
};

const computeStar = (radius: number, rng: Rng): StarValues => {
  const u1 = rng();
  const u2 = rng();
  const theta = TWO_PI * u1;
  const phi = Math.acos(1 - 2 * u2);
  const sinPhi = Math.sin(phi);
  const position: readonly [number, number, number] = [
    radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  ];
  const sizeT = rng();
  const size = lerp(STAR_SIZE_MIN, STAR_SIZE_MAX, sizeT * sizeT * sizeT);
  const sizeNorm = (size - STAR_SIZE_MIN) / (STAR_SIZE_MAX - STAR_SIZE_MIN);
  const brightness = lerp(STAR_BRIGHTNESS_MIN, STAR_BRIGHTNESS_MAX, sizeNorm);
  const color = sampleColor(sizeT < 0.3 ? PALETTE_DIM : PALETTE_BASE, rng());
  const pBase = TWINKLE_FRACTION * (1 + TWINKLE_BRIGHTNESS_BIAS * (sizeT - 0.5));
  const twinkle = rng() < pBase ? computeTwinkler(rng) : NO_TWINKLE;
  return { position, size, brightness, color, ...twinkle };
};

export const buildStarfieldSpec = (params: StarfieldSpecParams): StarfieldSpec => {
  const { layer, seed, count, radius } = params;
  const rng = mulberry32(seed);
  const arrays = {
    positions: new Float32Array(count * 3),
    sizes: new Float32Array(count),
    brightness: new Float32Array(count),
    colors: new Float32Array(count * 3),
    luminous: new Float32Array(count),
    twinkleAmps: new Float32Array(count),
    twinkleSpeeds: new Float32Array(count),
    twinkleSharps: new Float32Array(count),
    twinklePhases: new Float32Array(count),
  };

  for (let i = 0; i < count; i++) {
    const v = computeStar(radius, rng);
    arrays.positions[i * 3 + 0] = v.position[0];
    arrays.positions[i * 3 + 1] = v.position[1];
    arrays.positions[i * 3 + 2] = v.position[2];
    arrays.sizes[i] = v.size;
    arrays.brightness[i] = v.brightness;
    arrays.colors[i * 3 + 0] = v.color[0];
    arrays.colors[i * 3 + 1] = v.color[1];
    arrays.colors[i * 3 + 2] = v.color[2];
    arrays.twinkleAmps[i] = v.twinkleAmp;
    arrays.twinkleSpeeds[i] = v.twinkleSpeed;
    arrays.twinkleSharps[i] = v.twinkleSharp;
    arrays.twinklePhases[i] = v.twinklePhase;
  }

  const sortedBrightness = Array.from(arrays.brightness).sort((a, b) => a - b);
  const pThreshold = sortedBrightness[Math.floor(LUMINOUS_PERCENTILE * count)] ?? 0;
  const lumRange = Math.max((sortedBrightness[count - 1] ?? pThreshold) - pThreshold, 1e-6);
  const recolorRng = mulberry32((seed ^ 0x10000000) >>> 0);

  for (let i = 0; i < count; i++) {
    const b = arrays.brightness[i] ?? 0;
    if (b < pThreshold) continue;
    arrays.luminous[i] = Math.min(Math.max((b - pThreshold) / lumRange, 0), 1);
    const [cr, cg, cb] = sampleColor(PALETTE_LUMINOUS, recolorRng());
    arrays.colors[i * 3 + 0] = cr;
    arrays.colors[i * 3 + 1] = cg;
    arrays.colors[i * 3 + 2] = cb;
    const amp = arrays.twinkleAmps[i] ?? 0;
    if (amp > TWINKLE_AMP_LUMINOUS_CAP) arrays.twinkleAmps[i] = TWINKLE_AMP_LUMINOUS_CAP;
  }

  return { kind: 'starfield_spec', layer, count, ...arrays };
};
