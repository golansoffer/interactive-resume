import { ClampToEdgeWrapping, NearestFilter, SRGBColorSpace } from 'three';
import type { Texture } from 'three';
import type { PlanetAssetId } from '../../types/planet';
import type { PlanetLook } from './planetTypes';

export const PLANET_PATHS: Record<PlanetAssetId, string> = {
  earth_a: '/models/planets/EA05_Planets_Earth_01a.glb',
  earth_b: '/models/planets/EA05_Planets_Earth_01b.glb',
  jupiter_a: '/models/planets/EA05_Planets_Jowisz_01a.glb',
  jupiter_b: '/models/planets/EA05_Planets_Jowisz_01b.glb',
  mars_a: '/models/planets/EA05_Planets_Mars_01a.glb',
  mars_b: '/models/planets/EA05_Planets_Mars_01b.glb',
  mercury_a: '/models/planets/EA05_Planets_Mercury_01a.glb',
  mercury_b: '/models/planets/EA05_Planets_Mercury_01b.glb',
  moon_a: '/models/planets/EA05_Planets_Moon_01a.glb',
  moon_b: '/models/planets/EA05_Planets_Moon_01b.glb',
  neptune_a: '/models/planets/EA05_Planets_Neptun_01a.glb',
  neptune_b: '/models/planets/EA05_Planets_Neptun_01b.glb',
  pluto_a: '/models/planets/EA05_Planets_Pluton_01a.glb',
  pluto_b: '/models/planets/EA05_Planets_Pluton_01b.glb',
  saturn_a: '/models/planets/EA05_Planets_Saturn_01a.glb',
  saturn_b: '/models/planets/EA05_Planets_Saturn_01b.glb',
  sun_a: '/models/planets/EA05_Planets_Sun_01a.glb',
  sun_b: '/models/planets/EA05_Planets_Sun_01b.glb',
  uranus_a: '/models/planets/EA05_Planets_Uran_01a.glb',
  uranus_b: '/models/planets/EA05_Planets_Uran_01b.glb',
  venus_a: '/models/planets/EA05_Planets_Venus_01a.glb',
  venus_b: '/models/planets/EA05_Planets_Venus_01b.glb',
};

export const COLORSHEET_PATH = '/models/planets/Texture/Planet_Colorsheet_pastel_v1.png';

export const configureColorsheet = (texture: Texture): void => {
  texture.flipY = false;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
};

// Per-asset look. Each visible planet carries the full effect bundle (pulse
// for baseline aliveness, rim for active-mode glow). Missing asset ids fold
// to { kind: 'plain' } via resolvePlanetLook. Rim tints are spread across
// the wheel (cyan / gold / red-orange / magenta / violet); pulse emissive
// tints match each planet's character so the body's "alive" glow reads as
// its own color, not a generic warm light.
const PLANET_LOOK: Partial<Record<PlanetAssetId, PlanetLook>> = {
  jupiter_b: {
    kind: 'effects',
    pulse: { amplitude: 0.65, frequencyHz: 0.13, emissiveTint: [1.0, 0.58, 0.22] },
    rim: {
      tint: [1.0, 0.65, 0.28],
      power: 2.2,
      opacity: 0.82,
      scale: 1.12,
      breath: { amplitude: 0.27, frequencyHz: 0.09 },
      scalePulse: { amplitude: 0.08, frequencyHz: 0.32 },
    },
  },
  saturn_b: {
    kind: 'effects',
    pulse: { amplitude: 0.7, frequencyHz: 0.14, emissiveTint: [1.0, 0.52, 0.1] },
    rim: {
      tint: [1.0, 0.5, 0.08],
      power: 2.3,
      opacity: 0.83,
      scale: 1.13,
      breath: { amplitude: 0.28, frequencyHz: 0.11 },
      scalePulse: { amplitude: 0.09, frequencyHz: 0.42 },
    },
  },
  mars_b: {
    kind: 'effects',
    pulse: { amplitude: 0.68, frequencyHz: 0.17, emissiveTint: [1.0, 0.3, 0.12] },
    rim: {
      tint: [1.0, 0.32, 0.18],
      power: 2.1,
      opacity: 0.82,
      scale: 1.12,
      breath: { amplitude: 0.27, frequencyHz: 0.12 },
      scalePulse: { amplitude: 0.07, frequencyHz: 0.52 },
    },
  },
  venus_b: {
    kind: 'effects',
    pulse: { amplitude: 0.7, frequencyHz: 0.11, emissiveTint: [1.0, 0.18, 0.32] },
    rim: {
      tint: [1.0, 0.22, 0.55],
      power: 2.0,
      opacity: 0.85,
      scale: 1.14,
      breath: { amplitude: 0.30, frequencyHz: 0.08 },
      scalePulse: { amplitude: 0.09, frequencyHz: 0.48 },
    },
  },
  uranus_b: {
    kind: 'effects',
    pulse: { amplitude: 0.62, frequencyHz: 0.12, emissiveTint: [0.18, 0.78, 0.85] },
    rim: {
      tint: [0.22, 0.88, 0.92],
      power: 2.4,
      opacity: 0.80,
      scale: 1.11,
      breath: { amplitude: 0.26, frequencyHz: 0.1 },
      scalePulse: { amplitude: 0.08, frequencyHz: 0.3 },
    },
  },
};

export const resolvePlanetLook = (assetId: PlanetAssetId): PlanetLook => {
  const look = PLANET_LOOK[assetId];
  if (look === undefined) return { kind: 'plain' };
  return look;
};
