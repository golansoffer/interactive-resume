import type { ArchetypeTable, DepthLayer } from '../../types/celestial-flight';

const deg = (degrees: number): number => (degrees * Math.PI) / 180;

const BACKGROUND: DepthLayer = {
  kind: 'background',
  parallax: 0.99,
  capacity: 3,
  radius: 3500,
  bulgeMin: 70,
  bulgeMax: 180,
  arcAngleMinRad: deg(25),
  arcAngleMaxRad: deg(105),
  durationMin: 30,
  durationMax: 130,
  distribution: [{ archetype: 'asteroid_drift', weight: 1 }],
  palette: [
    [0.58, 0.62, 0.74],
    [0.66, 0.7, 0.82],
    [0.72, 0.78, 0.92],
    [0.5, 0.58, 0.72],
    [0.78, 0.82, 0.94],
  ],
};

const MIDGROUND: DepthLayer = {
  kind: 'midground',
  parallax: 0.97,
  capacity: 2,
  radius: 2400,
  bulgeMin: 130,
  bulgeMax: 320,
  arcAngleMinRad: deg(35),
  arcAngleMaxRad: deg(120),
  durationMin: 12,
  durationMax: 65,
  distribution: [
    { archetype: 'comet_hero', weight: 0.7 },
    { archetype: 'comet_distant', weight: 0.3 },
  ],
  palette: [
    [0.62, 0.94, 1.0],
    [0.7, 0.86, 1.0],
    [1.0, 0.78, 0.42],
    [1.0, 0.88, 0.55],
    [0.94, 0.97, 1.0],
  ],
};

export const defaultLayers = (): ReadonlyArray<DepthLayer> => [BACKGROUND, MIDGROUND];

const ARCHETYPES: ArchetypeTable = {
  comet_hero: {
    kind: 'comet_hero',
    trailWidth: 110,
    trailLength: 170,
    trailBlending: 'additive',
    trailOpacity: 0.92,
    trailAttenuationExponent: 0.6,
    trailDecay: 1.8,
    trailStride: 0,
    trailToneMapped: false,
    headSize: 20,
    haloStyle: 'soft',
    haloSizeMultiplier: 2.4,
    ease: 'smooth_s',
    tailCoastSeconds: 1.8,
  },
  comet_distant: {
    kind: 'comet_distant',
    trailWidth: 34,
    trailLength: 70,
    trailBlending: 'additive',
    trailOpacity: 0.55,
    trailAttenuationExponent: 2.0,
    trailDecay: 1.8,
    trailStride: 0,
    trailToneMapped: false,
    headSize: 7,
    haloStyle: 'soft',
    haloSizeMultiplier: 1.2,
    ease: 'linear',
    tailCoastSeconds: 1.8,
  },
  asteroid_drift: {
    kind: 'asteroid_drift',
    trailWidth: 9,
    trailLength: 15,
    trailBlending: 'normal',
    trailOpacity: 0.45,
    trailAttenuationExponent: 1.7,
    trailDecay: 1.8,
    trailStride: 0,
    trailToneMapped: true,
    headSize: 11,
    haloStyle: 'none',
    ease: 'linear',
    tailCoastSeconds: 1.8,
  },
};

export const defaultArchetypes = (): ArchetypeTable => ARCHETYPES;
