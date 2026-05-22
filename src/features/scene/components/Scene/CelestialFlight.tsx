import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import {
  AdditiveBlending,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type Sprite,
} from 'three';
import { getCelestialFlightHaloTexture } from '../../services/renderer/celestialFlightHaloTexture';
import type {
  DepthLayer,
  Flight,
  Rgb,
} from '../../types/celestial-flight';
import {
  applyFrameToRefs,
  createGroupAttacher,
  createTrailAttacher,
  type FrameScratch,
} from './celestialFlightFrameOps';

const attenuationFromExponent = (exponent: number): ((t: number) => number) =>
  (t: number): number => Math.pow(t, exponent);

const rgbToHex = (rgb: Rgb): string => {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255)));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255)));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

type HaloSpriteProps = {
  readonly colorHex: string;
  readonly size: number;
  readonly style: 'soft' | 'sharp';
  readonly spriteRef: (sprite: Sprite | null) => void;
};

const HaloSprite = ({ colorHex, size, style, spriteRef }: HaloSpriteProps): JSX.Element => (
  <sprite ref={spriteRef} scale={[size, size, 1]}>
    <spriteMaterial
      map={getCelestialFlightHaloTexture({ style })}
      color={colorHex}
      blending={AdditiveBlending}
      transparent
      depthWrite={false}
      toneMapped={false}
    />
  </sprite>
);

type FlightHeadGroupProps = {
  readonly flight: Flight;
  readonly colorHex: string;
  readonly coreRef: (mesh: Mesh | null) => void;
  readonly haloRef: (sprite: Sprite | null) => void;
};

const FlightHeadGroup = ({
  flight,
  colorHex,
  coreRef,
  haloRef,
}: FlightHeadGroupProps): JSX.Element => {
  const core = (
    <mesh ref={coreRef}>
      <sphereGeometry args={[flight.kind.headSize * 0.35, 12, 8]} />
      <meshBasicMaterial color={colorHex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
  if (flight.kind.haloStyle === 'none') return core;
  const haloSize = flight.kind.headSize * flight.kind.haloSizeMultiplier;
  return (
    <>
      {core}
      <HaloSprite
        colorHex={colorHex}
        size={haloSize}
        style={flight.kind.haloStyle}
        spriteRef={haloRef}
      />
    </>
  );
};

type CelestialFlightTrailProps = {
  readonly flight: Flight;
  readonly colorHex: string;
  readonly attachTrailMesh: (mesh: Mesh | null) => void;
  readonly attachGroup: (g: Group | null) => void;
  readonly attachCore: (m: Mesh | null) => void;
  readonly attachHalo: (s: Sprite | null) => void;
};

const CelestialFlightTrail = (props: CelestialFlightTrailProps): JSX.Element => {
  const attenuation = useMemo(
    () => attenuationFromExponent(props.flight.kind.trailAttenuationExponent),
    [props.flight.kind.trailAttenuationExponent],
  );
  return (
    <Trail
      width={props.flight.kind.trailWidth * props.flight.trailWidthScale}
      length={Math.max(
        1,
        Math.round(props.flight.kind.trailLength * props.flight.trailLengthScale),
      )}
      color={props.colorHex}
      decay={props.flight.kind.trailDecay}
      stride={props.flight.kind.trailStride}
      attenuation={attenuation}
      ref={props.attachTrailMesh}
    >
      <group ref={props.attachGroup}>
        <FlightHeadGroup
          flight={props.flight}
          colorHex={props.colorHex}
          coreRef={props.attachCore}
          haloRef={props.attachHalo}
        />
      </group>
    </Trail>
  );
};

type FlightWiring = {
  readonly attachTrailMesh: (mesh: Mesh | null) => void;
  readonly attachGroup: (g: Group | null) => void;
  readonly attachCore: (m: Mesh | null) => void;
  readonly attachHalo: (s: Sprite | null) => void;
};

const useCelestialFlightWiring = (flight: Flight, layer: DepthLayer): FlightWiring => {
  const groupRef = useRef<Group | null>(null);
  const coreRef = useRef<Mesh | null>(null);
  const haloRef = useRef<Sprite | null>(null);
  const trailMaterialRef = useRef<Material | null>(null);
  const scratch = useMemo<FrameScratch>(() => ({ tangentTarget: new Vector3() }), []);
  const camera = useThree((s) => s.camera);
  const clock = useThree((s) => s.clock);
  const baseTrailOpacity = flight.kind.trailOpacity;
  const attachTrailMesh = useMemo(
    () =>
      createTrailAttacher({
        baseOpacity: baseTrailOpacity,
        blending: flight.kind.trailBlending,
        toneMapped: flight.kind.trailToneMapped,
        target: trailMaterialRef,
      }),
    [baseTrailOpacity, flight.kind.trailBlending, flight.kind.trailToneMapped],
  );
  const attachGroup = useMemo(
    () => createGroupAttacher({ flight, layer, camera, clock, target: groupRef }),
    [flight, layer, camera, clock],
  );
  useFrame((state) => {
    applyFrameToRefs(
      {
        group: groupRef.current,
        core: coreRef.current,
        halo: haloRef.current,
        trailMaterial: trailMaterialRef.current,
      },
      flight,
      layer,
      baseTrailOpacity,
      state.clock.elapsedTime,
      state.camera.position,
      scratch,
    );
  });
  return {
    attachTrailMesh,
    attachGroup,
    attachCore: (m) => {
      coreRef.current = m;
    },
    attachHalo: (s) => {
      haloRef.current = s;
    },
  };
};

type CelestialFlightProps = {
  readonly flight: Flight;
  readonly layer: DepthLayer;
};

export const CelestialFlight = ({ flight, layer }: CelestialFlightProps): JSX.Element => {
  const wiring = useCelestialFlightWiring(flight, layer);
  return (
    <CelestialFlightTrail
      flight={flight}
      colorHex={rgbToHex(flight.color)}
      attachTrailMesh={wiring.attachTrailMesh}
      attachGroup={wiring.attachGroup}
      attachCore={wiring.attachCore}
      attachHalo={wiring.attachHalo}
    />
  );
};
