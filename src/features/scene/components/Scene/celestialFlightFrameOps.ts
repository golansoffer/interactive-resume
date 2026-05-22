import type { RefObject } from 'react';
import {
  AdditiveBlending,
  NormalBlending,
  type Blending,
  type Camera,
  type Clock,
  type Group,
  type Material,
  type Mesh,
  type Sprite,
  type Vector3,
} from 'three';
import { parallaxAnchor } from '../../services/renderer/celestialFlightSpec';
import { sampleFlight } from '../../services/renderer/celestialFlightFrame';
import { parseTrailMaterial } from '../../services/renderer/parseTrailMaterial';
import type {
  DepthLayer,
  Flight,
  FlightKind,
  FlightSample,
} from '../../types/celestial-flight';

type ActiveSample = Extract<FlightSample, { kind: 'traversing' | 'coasting' }>;

type WorldPosition = { readonly x: number; readonly y: number; readonly z: number };

const headOpacityFor = (sample: ActiveSample): number =>
  sample.kind === 'traversing' ? 1 : 1 - sample.coastProgress01;

const trailOpacityScaleFor = (sample: ActiveSample): number =>
  sample.kind === 'traversing' ? 1 : 1 - sample.coastProgress01;

const blendingFor = (kind: FlightKind['trailBlending']): Blending =>
  kind === 'additive' ? AdditiveBlending : NormalBlending;

const placeGroupAtSample = (
  group: Group,
  sample: ActiveSample,
  layerParallax: number,
  cameraPos: WorldPosition,
  tangentTarget: Vector3,
): void => {
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
};

export type FlightRefs = {
  readonly group: Group | null;
  readonly core: Mesh | null;
  readonly halo: Sprite | null;
  readonly trailMaterial: Material | null;
};

export type FrameScratch = {
  readonly tangentTarget: Vector3;
};

export const applyFrameToRefs = (
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

export type TrailAttachInput = {
  readonly baseOpacity: number;
  readonly blending: FlightKind['trailBlending'];
  readonly toneMapped: boolean;
  readonly target: RefObject<Material | null>;
};

export const createTrailAttacher =
  (input: TrailAttachInput): ((mesh: Mesh | null) => void) =>
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

export type AttachGroupInput = {
  readonly flight: Flight;
  readonly layer: DepthLayer;
  readonly camera: Camera;
  readonly clock: Clock;
  readonly target: RefObject<Group | null>;
};

// drei <Trail> seeds its position buffer from `target.position` in a
// useLayoutEffect that runs before any useFrame can place the trail target.
// Without priming the buffer fills with (0,0,0) and the first frame draws a
// streak from scene origin to the spawn point that takes hundreds of frames
// to rotate out. Refs commit before layout effects, so writing the world
// position in the ref callback lets drei seed from the correct position.
export const createGroupAttacher =
  (input: AttachGroupInput): ((g: Group | null) => void) =>
  (g: Group | null): void => {
    const prev = input.target.current;
    input.target.current = g;
    if (g === null || prev === g) return;
    const sample = sampleFlight(input.flight, input.clock.elapsedTime);
    if (sample.kind === 'completed') return;
    const cam = input.camera.position;
    const anchor = parallaxAnchor([cam.x, cam.y, cam.z], input.layer.parallax);
    g.position.set(
      anchor[0] + sample.position[0],
      anchor[1] + sample.position[1],
      anchor[2] + sample.position[2],
    );
  };
