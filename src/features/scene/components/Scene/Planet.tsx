import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, useGLTF, useTexture } from '@react-three/drei';
import { ClampToEdgeWrapping, NearestFilter, SRGBColorSpace } from 'three';
import type { Object3D, Texture } from 'three';
import type { PlanetAssetId } from '../../types/planet';
import type { PlanetProjection } from '../../types/projections';
import {
  animatePlan,
  buildVisualPlan,
  cloneAndDress,
  extractBody,
  rotationRateFor,
} from '../../services/renderer/planetVisualPlan';
import type { PlanetLook, PlanetVisualPlan } from '../../services/renderer/planetVisualPlan';
import type { PlanetActivations, PlanetRadii } from './useSceneRefs';

type PlanetProps = {
  readonly planet: PlanetProjection;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
};

const PLANET_BASE_SCALE = 1.5;
// Barely-perceptible sway, phase-offset per CompanyId so the five planets
// don't sway in unison.
const PLANET_SWAY_AMPLITUDE = Math.PI / 220;
const PLANET_SWAY_FREQ_HZ = 0.05;
// Volumetric breath — ~2.5% scale oscillation, slow. Only applies in active
// mode; idle planets hold their static scale. Phase-offset per planet so
// the ring doesn't breathe in unison.
const SCALE_BREATH_AMP = 0.025;
const SCALE_BREATH_FREQ_HZ = 0.05;
// Exponential smoothing rate for the activation fade. 1/rate ≈ 0.25 s time
// constant — proximity enter/exit translates to a smooth ~0.5 s ramp on the
// rim and scale-breath effects.
const ACTIVATION_LERP_RATE = 4.0;
// Active-radius multiplier on each planet's visible body radius. 2.5× visible
// radius = ~1.25× visible diameter, so the rim lights up about half a planet-
// diameter before the player reaches the surface.
const ACTIVATION_RADIUS_MULTIPLIER = 2.5;
const TWO_PI = Math.PI * 2;

const PLANET_PATHS: Record<PlanetAssetId, string> = {
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

// Per-asset look. Each visible planet carries the full effect bundle (pulse
// for baseline aliveness, rim for active-mode glow). Missing asset ids fold
// to { kind: 'plain' } via resolvePlanetLook. Rim tints are spread across
// the wheel (cyan / gold / red-orange / magenta / violet); pulse emissive
// tints match each planet's character so the body's "alive" glow reads as
// its own color, not a generic warm light.
const PLANET_LOOK: Partial<Record<PlanetAssetId, PlanetLook>> = {
  earth_b: {
    kind: 'effects',
    pulse: { amplitude: 0.28, frequencyHz: 0.13, emissiveTint: [0.25, 0.55, 1.0] },
    rim: {
      tint: [0.18, 0.72, 1.0],
      power: 2.4,
      opacity: 0.7,
      scale: 1.09,
      breath: { amplitude: 0.22, frequencyHz: 0.09 },
    },
  },
  saturn_b: {
    kind: 'effects',
    pulse: { amplitude: 0.3, frequencyHz: 0.14, emissiveTint: [1.0, 0.78, 0.45] },
    rim: {
      tint: [1.0, 0.62, 0.18],
      power: 2.6,
      opacity: 0.6,
      scale: 1.1,
      breath: { amplitude: 0.2, frequencyHz: 0.11 },
    },
  },
  mars_b: {
    kind: 'effects',
    pulse: { amplitude: 0.35, frequencyHz: 0.17, emissiveTint: [1.0, 0.42, 0.18] },
    rim: {
      tint: [1.0, 0.42, 0.2],
      power: 2.5,
      opacity: 0.65,
      scale: 1.1,
      breath: { amplitude: 0.22, frequencyHz: 0.12 },
    },
  },
  venus_b: {
    kind: 'effects',
    pulse: { amplitude: 0.32, frequencyHz: 0.11, emissiveTint: [1.0, 0.32, 0.3] },
    rim: {
      tint: [1.0, 0.32, 0.5],
      power: 2.0,
      opacity: 0.8,
      scale: 1.13,
      breath: { amplitude: 0.25, frequencyHz: 0.08 },
    },
  },
  neptune_b: {
    kind: 'effects',
    pulse: { amplitude: 0.27, frequencyHz: 0.12, emissiveTint: [0.4, 0.55, 1.0] },
    rim: {
      tint: [0.28, 0.32, 1.0],
      power: 2.8,
      opacity: 0.6,
      scale: 1.08,
      breath: { amplitude: 0.18, frequencyHz: 0.1 },
    },
  },
};

export const resolvePlanetLook = (assetId: PlanetAssetId): PlanetLook => {
  const look = PLANET_LOOK[assetId];
  if (look === undefined) return { kind: 'plain' };
  return look;
};

const COLORSHEET_PATH = '/models/planets/Texture/Planet_Colorsheet_pastel_v1.png';

const configureColorsheet = (texture: Texture): void => {
  texture.flipY = false;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
};

const idEncoder = new TextEncoder();
const phaseFromId = (id: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(id)) hash = (hash * 31 + byte) % 1000;
  return (hash / 1000) * TWO_PI;
};

export const Planet = (props: PlanetProps): JSX.Element => {
  const assetId = props.planet.planet.assetId;
  const { scene } = useGLTF(PLANET_PATHS[assetId]);
  const colorsheet = useTexture(COLORSHEET_PATH);
  const look = useMemo(() => resolvePlanetLook(assetId), [assetId]);
  const phase = useMemo(() => phaseFromId(props.planet.id), [props.planet.id]);
  const plan = useMemo<PlanetVisualPlan>(() => {
    configureColorsheet(colorsheet);
    return buildVisualPlan(look, cloneAndDress(scene, colorsheet, look), phase);
  }, [scene, colorsheet, look, phase]);
  // Measure visible body radius from the loaded GLB and publish the active
  // radius (visible radius × multiplier) to the shared registry that
  // ProximityWatcher reads — so each planet's activation zone is sized to
  // its own visible footprint, not a global constant.
  const activeRadius = useMemo(() => {
    const extraction = extractBody(scene);
    if (extraction.kind !== 'body') return 0;
    return extraction.radius * PLANET_BASE_SCALE * ACTIVATION_RADIUS_MULTIPLIER;
  }, [scene]);
  props.planetRadiiRef.current.write(props.planet.id, activeRadius);
  const meshRef = useRef<Object3D | null>(null);
  const activationFactorRef = useRef(0);
  const rotationRate = useMemo(() => rotationRateFor(phase), [phase]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (mesh === null) return;
    mesh.rotation.y += rotationRate * delta;
    const time = state.clock.elapsedTime;
    mesh.rotation.z =
      Math.sin(time * PLANET_SWAY_FREQ_HZ * TWO_PI + phase * 1.3) * PLANET_SWAY_AMPLITUDE;
    const target = props.planetActivationsRef.current.isActive(props.planet.id) ? 1 : 0;
    const current = activationFactorRef.current;
    const blend = 1 - Math.exp(-ACTIVATION_LERP_RATE * delta);
    const factor = current + (target - current) * blend;
    activationFactorRef.current = factor;
    const scaleBreath = Math.sin(time * SCALE_BREATH_FREQ_HZ * TWO_PI + phase * 0.7);
    const s = PLANET_BASE_SCALE * (1 + scaleBreath * SCALE_BREATH_AMP * factor);
    mesh.scale.set(s, s, s);
    animatePlan(plan, time, phase, factor);
  });

  return (
    <group ref={meshRef} position={props.planet.planet.placement}>
      <Center>
        <primitive object={plan.scene} />
      </Center>
    </group>
  );
};

useTexture.preload(COLORSHEET_PATH);
for (const path of Object.values(PLANET_PATHS)) useGLTF.preload(path);
