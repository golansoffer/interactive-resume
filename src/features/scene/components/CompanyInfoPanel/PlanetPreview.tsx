import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, Resize, useGLTF, useTexture } from '@react-three/drei';
import type { Group, MeshStandardMaterial, Object3D } from 'three';
import type { PlanetAssetId } from '../../types/planet';
import {
  COLORSHEET_PATH,
  PLANET_PATHS,
  configureColorsheet,
  resolvePlanetLook,
} from '../../services/renderer/planetAssets';
import { cloneAndDress } from '../../services/renderer/planetVisualPlan';
import type { PulseSpec } from '../../services/renderer/planetTypes';
import { animatePulse } from '../../services/renderer/planetAnimation';

// Contemplative rotation — eye rests on the text, not the model.
const ROTATION_RATE_RAD_PER_SEC = 0.6;

const KEY_COLOR = '#fff5e8';
const FILL_COLOR = '#a8d4ff';

type PlanetPreviewProps = {
  readonly assetId: PlanetAssetId;
};

type DressedScene =
  | { readonly kind: 'plain'; readonly scene: Object3D }
  | {
      readonly kind: 'effects';
      readonly scene: Object3D;
      readonly materials: ReadonlyArray<MeshStandardMaterial>;
      readonly pulse: PulseSpec;
    };

// Pulse phase offset per-asset so different planets aren't in lockstep when
// shown back-to-back across reveals.
const idEncoder = new TextEncoder();
const TWO_PI = Math.PI * 2;
const phaseFromAsset = (assetId: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(assetId)) hash = (hash * 31 + byte) % 1000;
  return (hash / 1000) * TWO_PI;
};

const useDressedScene = (assetId: PlanetAssetId): DressedScene => {
  const { scene } = useGLTF(PLANET_PATHS[assetId]);
  const colorsheet = useTexture(COLORSHEET_PATH);
  return useMemo(() => {
    configureColorsheet(colorsheet);
    const look = resolvePlanetLook(assetId);
    const dressed = cloneAndDress(scene, colorsheet, look);
    if (look.kind === 'plain') {
      return { kind: 'plain', scene: dressed.scene };
    }
    return {
      kind: 'effects',
      scene: dressed.scene,
      materials: dressed.standardMaterials,
      pulse: look.pulse,
    };
  }, [scene, colorsheet, assetId]);
};

const usePreviewFrame = (
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

const PlanetScene = (props: PlanetPreviewProps): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const dressed = useDressedScene(props.assetId);
  const phase = useMemo(() => phaseFromAsset(props.assetId), [props.assetId]);
  usePreviewFrame(groupRef, dressed, phase);
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={2.0} color={KEY_COLOR} />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} color={FILL_COLOR} />
      <group ref={groupRef} scale={1.4}>
        <Center>
          <Resize>
            <primitive object={dressed.scene} />
          </Resize>
        </Center>
      </group>
    </>
  );
};

export const PlanetPreview = (props: PlanetPreviewProps): JSX.Element => (
  <div className="relative aspect-square w-full overflow-hidden rounded-lg ring-1 ring-foreground/15 bg-[radial-gradient(120%_80%_at_50%_40%,rgba(22,22,22,0.85)_0%,rgba(10,10,10,0.92)_75%)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 3.6], fov: 28 }}>
      <PlanetScene assetId={props.assetId} />
    </Canvas>
  </div>
);
