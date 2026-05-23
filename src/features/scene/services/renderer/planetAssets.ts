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

// Pulse-only look used by every non-active-capable planet asset id.
// Gentle, slow, low-amplitude, neutral warm-white tint that brightens
// without shifting the colorsheet's hue. Phase desync between planets is
// handled at consumer level (phaseFromId). Floor 0.3 matches the prior
// static PLAIN_EMISSIVE_INTENSITY so the pulse trough sits at today's
// visible brightness and the peak only adds light.
const DEFAULT_BODY_ONLY: PlanetLook = {
  kind: 'body_only',
  pulse: {
    amplitude: 0.12,
    frequencyHz: 0.05,
    floor: 0.3,
    emissiveTint: [1.0, 0.95, 0.85],
  },
};

// Per-asset look — TotalMap over PlanetAssetId so the lookup is
// proof-bearing (no `kind: 'plain'` / `undefined` narrow at the consumer).
// Six entries are active-capable: each carries a body pulse (baseline
// aliveness, always on) and a rim (fresnel atmosphere gated on activation).
// Every other id points to DEFAULT_BODY_ONLY — pulse-driven aliveness, no
// rim. Rim tints span the wheel (cyan / gold / red-orange / magenta /
// violet); pulse emissive tints match each planet's character so the
// body's "alive" glow reads as its own color, not a generic warm light.
const PLANET_LOOK: Record<PlanetAssetId, PlanetLook> = {
  earth_a: DEFAULT_BODY_ONLY,
  earth_b: {
    kind: 'body_and_rim',
    pulse: { amplitude: 0.65, frequencyHz: 0.13, floor: 0.5, emissiveTint: [0.2, 0.55, 0.9] },
    rim: {
      tint: [0.3, 0.65, 1.0],
      power: 2.2,
      opacity: 0.84,
      scale: 1.13,
      breath: { amplitude: 0.28, frequencyHz: 0.1 },
      scalePulse: { amplitude: 0.08, frequencyHz: 0.35 },
    },
  },
  jupiter_a: DEFAULT_BODY_ONLY,
  jupiter_b: {
    kind: 'body_and_rim',
    pulse: { amplitude: 0.65, frequencyHz: 0.13, floor: 0.5, emissiveTint: [1.0, 0.58, 0.22] },
    rim: {
      tint: [1.0, 0.65, 0.28],
      power: 2.2,
      opacity: 0.82,
      scale: 1.12,
      breath: { amplitude: 0.27, frequencyHz: 0.09 },
      scalePulse: { amplitude: 0.08, frequencyHz: 0.32 },
    },
  },
  mars_a: DEFAULT_BODY_ONLY,
  mars_b: {
    kind: 'body_and_rim',
    pulse: { amplitude: 0.68, frequencyHz: 0.17, floor: 0.5, emissiveTint: [1.0, 0.3, 0.12] },
    rim: {
      tint: [1.0, 0.32, 0.18],
      power: 2.1,
      opacity: 0.82,
      scale: 1.12,
      breath: { amplitude: 0.27, frequencyHz: 0.12 },
      scalePulse: { amplitude: 0.07, frequencyHz: 0.52 },
    },
  },
  mercury_a: DEFAULT_BODY_ONLY,
  mercury_b: DEFAULT_BODY_ONLY,
  moon_a: DEFAULT_BODY_ONLY,
  moon_b: DEFAULT_BODY_ONLY,
  neptune_a: DEFAULT_BODY_ONLY,
  neptune_b: DEFAULT_BODY_ONLY,
  pluto_a: DEFAULT_BODY_ONLY,
  pluto_b: DEFAULT_BODY_ONLY,
  saturn_a: DEFAULT_BODY_ONLY,
  saturn_b: {
    kind: 'body_and_rim',
    pulse: { amplitude: 0.7, frequencyHz: 0.14, floor: 0.5, emissiveTint: [1.0, 0.52, 0.1] },
    rim: {
      tint: [1.0, 0.5, 0.08],
      power: 2.3,
      opacity: 0.83,
      scale: 1.13,
      breath: { amplitude: 0.28, frequencyHz: 0.11 },
      scalePulse: { amplitude: 0.09, frequencyHz: 0.42 },
    },
  },
  sun_a: DEFAULT_BODY_ONLY,
  sun_b: DEFAULT_BODY_ONLY,
  uranus_a: DEFAULT_BODY_ONLY,
  uranus_b: {
    kind: 'body_and_rim',
    pulse: { amplitude: 0.62, frequencyHz: 0.12, floor: 0.5, emissiveTint: [0.18, 0.78, 0.85] },
    rim: {
      tint: [0.22, 0.88, 0.92],
      power: 2.4,
      opacity: 0.80,
      scale: 1.11,
      breath: { amplitude: 0.26, frequencyHz: 0.1 },
      scalePulse: { amplitude: 0.08, frequencyHz: 0.3 },
    },
  },
  venus_a: DEFAULT_BODY_ONLY,
  venus_b: {
    kind: 'body_and_rim',
    pulse: { amplitude: 0.7, frequencyHz: 0.11, floor: 0.5, emissiveTint: [1.0, 0.18, 0.32] },
    rim: {
      tint: [1.0, 0.22, 0.55],
      power: 2.0,
      opacity: 0.85,
      scale: 1.14,
      breath: { amplitude: 0.30, frequencyHz: 0.08 },
      scalePulse: { amplitude: 0.09, frequencyHz: 0.48 },
    },
  },
};

export const resolvePlanetLook = (assetId: PlanetAssetId): PlanetLook =>
  PLANET_LOOK[assetId];
