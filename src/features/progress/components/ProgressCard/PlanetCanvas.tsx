import { useMemo, useRef, type JSX, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import type { Group, MeshStandardMaterial, Object3D } from 'three';
import { assetUrl } from '@/lib/assetUrl';
import type { PlanetAssetId } from '../../../scene/types/planet';
import {
  COLORSHEET_PATH,
  PLANET_PATHS,
  configureColorsheet,
  resolvePlanetLook,
} from '../../../scene/services/renderer/planetAssets';
import { cloneAndDress } from '../../../scene/services/renderer/planetVisualPlan';
import type { PulseSpec } from '../../../scene/services/renderer/planetTypes';
import { animatePulse } from '../../../scene/services/renderer/planetAnimation';
import { planetPoseFor } from '../../../scene/services/renderer/planetPose';
import type { PlanetPose } from '../../../scene/services/renderer/planetPose';
import { computePlanetPreviewFit } from '../../../scene/services/renderer/planetPreviewFit';
import type { PlanetPreviewFit } from '../../../scene/services/renderer/planetPreviewFit';

const ROTATION_RATE_RAD_PER_SEC = 0.6;
const KEY_COLOR = '#fff5e8';
const FILL_COLOR = '#a8d4ff';

type PlanetCanvasProps = {
  readonly assetId: PlanetAssetId;
};

type DressedScene =
  | {
      readonly kind: 'plain';
      readonly scene: Object3D;
      readonly pose: PlanetPose;
      readonly fit: PlanetPreviewFit;
    }
  | {
      readonly kind: 'effects';
      readonly scene: Object3D;
      readonly materials: ReadonlyArray<MeshStandardMaterial>;
      readonly pulse: PulseSpec;
      readonly pose: PlanetPose;
      readonly fit: PlanetPreviewFit;
    };

const idEncoder = new TextEncoder();
const TWO_PI = Math.PI * 2;
const phaseFromAsset = (assetId: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(assetId)) hash = (hash * 31 + byte) % 1000;
  return (hash / 1000) * TWO_PI;
};

const useDressedScene = (assetId: PlanetAssetId): DressedScene => {
  const { scene } = useGLTF(assetUrl(PLANET_PATHS[assetId]));
  const colorsheet = useTexture(assetUrl(COLORSHEET_PATH));
  return useMemo(() => {
    configureColorsheet(colorsheet);
    const look = resolvePlanetLook(assetId);
    const dressed = cloneAndDress(scene, colorsheet, look);
    const pose = planetPoseFor(dressed.extraction);
    const fit = computePlanetPreviewFit(dressed.scene, pose.alignQuaternion);
    if (look.kind === 'plain') {
      return { kind: 'plain', scene: dressed.scene, pose, fit };
    }
    return {
      kind: 'effects',
      scene: dressed.scene,
      materials: dressed.standardMaterials,
      pulse: look.pulse,
      pose,
      fit,
    };
  }, [scene, colorsheet, assetId]);
};

const useRotatingFrame = (
  groupRef: RefObject<Group | null>,
  dressed: DressedScene,
  phase: number,
): void => {
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y += ROTATION_RATE_RAD_PER_SEC * delta;
    if (dressed.kind === 'effects') {
      animatePulse(dressed.materials, dressed.pulse, state.clock.elapsedTime, phase);
    }
  });
};

const RotatingPlanetScene = (props: PlanetCanvasProps): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const dressed = useDressedScene(props.assetId);
  const phase = useMemo(() => phaseFromAsset(props.assetId), [props.assetId]);
  useRotatingFrame(groupRef, dressed, phase);
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={2.0} color={KEY_COLOR} />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} color={FILL_COLOR} />
      <group scale={1.4}>
        <group scale={dressed.fit.uniformScale}>
          <group position={dressed.fit.translation}>
            <group ref={groupRef}>
              <group quaternion={dressed.pose.alignQuaternion}>
                <primitive object={dressed.scene} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </>
  );
};

export const PlanetCanvas = (props: PlanetCanvasProps): JSX.Element => (
  <div
    data-asset={props.assetId}
    className="relative h-full w-full overflow-hidden rounded-full"
  >
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 3.6], fov: 28 }}>
      <RotatingPlanetScene {...props} />
    </Canvas>
  </div>
);
