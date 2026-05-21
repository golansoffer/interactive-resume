import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import {
  AdditiveBlending,
  NormalBlending,
  Vector3,
  type Blending,
  type Group,
  type Material,
  type Mesh,
  type Sprite,
} from 'three';
import { parallaxAnchor } from '../../services/renderer/celestialFlightSpec';
import { sampleFlight } from '../../services/renderer/celestialFlightFrame';
import { getCelestialFlightHaloTexture } from '../../services/renderer/celestialFlightHaloTexture';
import { parseTrailMaterial } from '../../services/renderer/parseTrailMaterial';
import type {
  DepthLayer,
  Flight,
  FlightKind,
  FlightSample,
  Rgb,
} from '../../types/celestial-flight';

const blendingFor = (kind: FlightKind['trailBlending']): Blending =>
  kind === 'additive' ? AdditiveBlending : NormalBlending;

const attenuationFromExponent = (exponent: number): ((t: number) => number) =>
  (t: number): number => Math.pow(t, exponent);

const rgbToHex = (rgb: Rgb): string => {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255)));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255)));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

type ActiveSample = Extract<FlightSample, { kind: 'traversing' | 'coasting' }>;

const headOpacityFor = (sample: ActiveSample): number =>
  sample.kind === 'traversing' ? 1 : 1 - sample.coastProgress01;

const trailOpacityScaleFor = (sample: ActiveSample): number =>
  sample.kind === 'traversing' ? 1 : 1 - sample.coastProgress01;

type WorldPosition = { readonly x: number; readonly y: number; readonly z: number };

const placeGroupAtSample = (
  group: Group,
  sample: ActiveSample,
  layerParallax: number,
  cameraPos: WorldPosition,
  tangentTarget: Vector3,
): WorldPosition => {
  const anchor = parallaxAnchor([cameraPos.x, cameraPos.y, cameraPos.z], layerParallax);
  const worldX = anchor[0] + sample.position[0];
  const worldY = anchor[1] + sample.position[1];
  const worldZ = anchor[2] + sample.position[2];
  group.visible = true;
  group.position.set(worldX, worldY, worldZ);
  tangentTarget.set(
    worldX + sample.tangent[0],
    worldY + sample.tangent[1],
    worldZ + sample.tangent[2],
  );
  group.lookAt(tangentTarget);
  return { x: worldX, y: worldY, z: worldZ };
};

type FlightRefs = {
  readonly group: Group | null;
  readonly core: Mesh | null;
  readonly halo: Sprite | null;
  readonly trailMaterial: Material | null;
};

type FrameScratch = {
  readonly tangentTarget: Vector3;
};

const applyFrameToRefs = (
  refs: FlightRefs,
  flight: Flight,
  layer: DepthLayer,
  baseTrailOpacity: number,
  now: number,
  cameraPos: WorldPosition,
  scratch: FrameScratch,
): void => {
  const group = refs.group;
  if (group === null) return;
  const sample = sampleFlight(flight, now);
  if (sample.kind === 'completed') {
    group.visible = false;
    return;
  }
  placeGroupAtSample(group, sample, layer.parallax, cameraPos, scratch.tangentTarget);
  const headOpacity = headOpacityFor(sample);
  if (refs.core !== null) parseTrailMaterial(refs.core).opacity = headOpacity;
  if (refs.halo !== null) refs.halo.material.opacity = headOpacity;
  if (refs.trailMaterial !== null)
    refs.trailMaterial.opacity = baseTrailOpacity * trailOpacityScaleFor(sample);
};

type TrailAttachInput = {
  readonly baseOpacity: number;
  readonly blending: FlightKind['trailBlending'];
  readonly toneMapped: boolean;
  readonly target: RefObject<Material | null>;
};

const createTrailAttacher = (input: TrailAttachInput): ((mesh: Mesh | null) => void) =>
  (mesh: Mesh | null): void => {
    if (mesh === null) {
      input.target.current = null;
      return;
    }
    const mat = parseTrailMaterial(mesh);
    mat.transparent = true;
    mat.opacity = input.baseOpacity;
    mat.depthWrite = false;
    mat.blending = blendingFor(input.blending);
    mat.toneMapped = input.toneMapped;
    mat.needsUpdate = true;
    input.target.current = mat;
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
  const scratch = useMemo<FrameScratch>(
    () => ({ tangentTarget: new Vector3() }),
    [],
  );
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
    attachGroup: (g) => {
      groupRef.current = g;
    },
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
