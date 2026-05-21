import type { JSX } from 'react';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, Trail, useGLTF } from '@react-three/drei';
import { AdditiveBlending, NormalBlending } from 'three';
import type { Blending, Mesh, Object3D } from 'three';

type AsteroidAssetId = 'moon_a' | 'moon_b' | 'mercury_a' | 'mercury_b';

const ASTEROID_PATHS: Record<AsteroidAssetId, string> = {
  moon_a: '/models/planets/EA05_Planets_Moon_01a.glb',
  moon_b: '/models/planets/EA05_Planets_Moon_01b.glb',
  mercury_a: '/models/planets/EA05_Planets_Mercury_01a.glb',
  mercury_b: '/models/planets/EA05_Planets_Mercury_01b.glb',
};

const pickAsteroidAssetId = (i: number): AsteroidAssetId =>
  i % 2 === 0 ? 'moon_a' : 'moon_b';
const pickCometAssetId = (i: number): AsteroidAssetId =>
  i % 2 === 0 ? 'mercury_a' : 'mercury_b';

const ASTEROID_COUNT = 5;
const COMET_COUNT = 5;
const HORIZON_BODY_CAP = 10;
const HORIZON_BODY_TOTAL = ASTEROID_COUNT + COMET_COUNT;
if (HORIZON_BODY_TOTAL !== HORIZON_BODY_CAP) {
  throw new Error(`Asteroids: total ${HORIZON_BODY_TOTAL} must equal cap ${HORIZON_BODY_CAP}.`);
}

const SHELL_RADIUS = 280;
const PHI_MIN = Math.PI / 3;
const PHI_MAX = (Math.PI * 2) / 3;

const ASTEROID_SCALE_MIN = 0.12;
const ASTEROID_SCALE_MAX = 0.3;
const ASTEROID_VEL_MIN = 0.0005;
const ASTEROID_VEL_MAX = 0.0015;
// Asteroid trail — barely a dust wake. Just enough to convey motion.
const ASTEROID_TRAIL_WIDTH = 2.5;
const ASTEROID_TRAIL_LENGTH = 3;
const ASTEROID_TRAIL_COLOR = '#6e7378';
const ASTEROID_TRAIL_OPACITY = 0.22;

const COMET_SCALE_MIN = 0.2;
const COMET_SCALE_MAX = 0.45;
const COMET_VEL_MIN = 0.05;
const COMET_VEL_MAX = 0.13;
// Comet trail — long icy streak, additive-blended for that AAA "glow"
// stacking. Width is wide at head and tapers sharply at tail via attenuation.
const COMET_TRAIL_WIDTH_MIN = 14;
const COMET_TRAIL_WIDTH_MAX = 26;
const COMET_TRAIL_LENGTH_MIN = 28;
const COMET_TRAIL_LENGTH_MAX = 44;
const COMET_TRAIL_OPACITY_MIN = 0.5;
const COMET_TRAIL_OPACITY_MAX = 0.75;

const cometTrailColorFor = (i: number): string => {
  const slot = i % 4;
  if (slot === 0) return '#b8dcff';
  if (slot === 1) return '#a4c8ff';
  if (slot === 2) return '#d0e4ff';
  return '#8cc0f8';
};

const TRAIL_DECAY = 1;
// Asteroid: linear width fade (subtle wake). Comet: square-root keeps the
// trail fat through most of its length then sharply fades at the very tail.
const ASTEROID_ATTENUATION = (t: number): number => t;
const COMET_ATTENUATION = (t: number): number => Math.pow(t, 0.55);

const hashIndex = (i: number, salt: number): number => {
  const seed = (i + 1) * 12.9898 + (salt + 1) * 78.233;
  const s = Math.sin(seed) * 43758.5453;
  return s - Math.floor(s);
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

type TrailSpec = {
  readonly width: number;
  readonly length: number;
  readonly color: string;
  readonly opacity: number;
  readonly blending: Blending;
  readonly attenuation: (t: number) => number;
};

type HorizonBody =
  | {
      readonly kind: 'asteroid';
      readonly assetId: AsteroidAssetId;
      readonly initialAngle: number;
      readonly orbitRadius: number;
      readonly y: number;
      readonly scale: number;
      readonly angularVelocity: number;
      readonly trail: TrailSpec;
    }
  | {
      readonly kind: 'comet';
      readonly assetId: AsteroidAssetId;
      readonly initialAngle: number;
      readonly orbitRadius: number;
      readonly y: number;
      readonly scale: number;
      readonly angularVelocity: number;
      readonly trail: TrailSpec;
    };

const directionFor = (i: number, salt: number): number =>
  hashIndex(i, salt) < 0.5 ? -1 : 1;

const initialAngleFor = (i: number): number =>
  ((i * 7) % HORIZON_BODY_TOTAL) * ((Math.PI * 2) / HORIZON_BODY_TOTAL) +
  hashIndex(i, 1) * 0.4;

const phiFor = (i: number): number => lerp(PHI_MIN, PHI_MAX, hashIndex(i, 11));

const buildAsteroidSpec = (i: number): HorizonBody => {
  const phi = phiFor(i);
  return {
    kind: 'asteroid',
    assetId: pickAsteroidAssetId(i),
    initialAngle: initialAngleFor(i),
    orbitRadius: SHELL_RADIUS * Math.sin(phi),
    y: SHELL_RADIUS * Math.cos(phi),
    scale: lerp(ASTEROID_SCALE_MIN, ASTEROID_SCALE_MAX, hashIndex(i, 3)),
    angularVelocity:
      lerp(ASTEROID_VEL_MIN, ASTEROID_VEL_MAX, hashIndex(i, 4)) * directionFor(i, 5),
    trail: {
      width: ASTEROID_TRAIL_WIDTH,
      length: ASTEROID_TRAIL_LENGTH,
      color: ASTEROID_TRAIL_COLOR,
      opacity: ASTEROID_TRAIL_OPACITY,
      blending: NormalBlending,
      attenuation: ASTEROID_ATTENUATION,
    },
  };
};

const buildCometSpec = (i: number): HorizonBody => {
  const phi = phiFor(i);
  return {
    kind: 'comet',
    assetId: pickCometAssetId(i),
    initialAngle: initialAngleFor(i),
    orbitRadius: SHELL_RADIUS * Math.sin(phi),
    y: SHELL_RADIUS * Math.cos(phi),
    scale: lerp(COMET_SCALE_MIN, COMET_SCALE_MAX, hashIndex(i, 3)),
    angularVelocity:
      lerp(COMET_VEL_MIN, COMET_VEL_MAX, hashIndex(i, 4)) * directionFor(i, 5),
    trail: {
      width: lerp(COMET_TRAIL_WIDTH_MIN, COMET_TRAIL_WIDTH_MAX, hashIndex(i, 6)),
      // drei's Trail allocates Float32Array(length * 10 * 3); a fractional
      // length truncates to a non-multiple-of-3 buffer, and meshline's
      // setPoints then reads `points[j+1]/points[j+2]` past the end → NaN
      // positions → infinite computeBoundingSphere/Box warnings every frame.
      // Sample count is inherently discrete, so round at construction.
      length: Math.round(
        lerp(COMET_TRAIL_LENGTH_MIN, COMET_TRAIL_LENGTH_MAX, hashIndex(i, 7)),
      ),
      color: cometTrailColorFor(i),
      opacity: lerp(COMET_TRAIL_OPACITY_MIN, COMET_TRAIL_OPACITY_MAX, hashIndex(i, 8)),
      blending: AdditiveBlending,
      attenuation: COMET_ATTENUATION,
    },
  };
};

const buildHorizonSpec = (i: number): HorizonBody =>
  i < ASTEROID_COUNT ? buildAsteroidSpec(i) : buildCometSpec(i);

const HORIZON_SPECS: ReadonlyArray<HorizonBody> = Array.from(
  { length: HORIZON_BODY_TOTAL },
  (_, i) => buildHorizonSpec(i),
);

type HorizonCell = {
  readonly spec: HorizonBody;
  readonly scene: Object3D;
  node: Object3D | null;
};

type HorizonBodyProps = {
  readonly spec: HorizonBody;
  readonly scene: Object3D;
  readonly meshRef: (node: Object3D | null) => void;
};

// drei's Trail forwards a ref to its inner Mesh. We can read mesh.material
// (which is a Material — base class supports transparent / opacity / blending /
// depthWrite) and mutate those props directly, no meshline import needed.
const tweakTrailMaterial =
  (spec: TrailSpec) =>
  (mesh: Mesh | null): void => {
    if (mesh === null) return;
    const mat = mesh.material;
    if (Array.isArray(mat)) return;
    mat.transparent = true;
    mat.opacity = spec.opacity;
    mat.depthWrite = false;
    mat.blending = spec.blending;
    mat.needsUpdate = true;
  };

const HorizonBodyView = (props: HorizonBodyProps): JSX.Element => {
  const scaleTriple = useMemo<readonly [number, number, number]>(
    () => [props.spec.scale, props.spec.scale, props.spec.scale],
    [props.spec.scale],
  );
  const { trail } = props.spec;
  return (
    <group ref={props.meshRef}>
      <Trail
        ref={tweakTrailMaterial(trail)}
        width={trail.width}
        length={trail.length}
        color={trail.color}
        decay={TRAIL_DECAY}
        attenuation={trail.attenuation}
      >
        <group scale={scaleTriple}>
          <Center>
            <primitive object={props.scene} />
          </Center>
        </group>
      </Trail>
    </group>
  );
};

const useHorizonSources = (): Record<AsteroidAssetId, Object3D> => {
  const moonA = useGLTF(ASTEROID_PATHS.moon_a);
  const moonB = useGLTF(ASTEROID_PATHS.moon_b);
  const mercuryA = useGLTF(ASTEROID_PATHS.mercury_a);
  const mercuryB = useGLTF(ASTEROID_PATHS.mercury_b);
  return useMemo(
    () => ({
      moon_a: moonA.scene,
      moon_b: moonB.scene,
      mercury_a: mercuryA.scene,
      mercury_b: mercuryB.scene,
    }),
    [moonA.scene, moonB.scene, mercuryA.scene, mercuryB.scene],
  );
};

const useHorizonCells = (
  sources: Record<AsteroidAssetId, Object3D>,
): ReadonlyArray<HorizonCell> =>
  useMemo(
    () =>
      HORIZON_SPECS.map((spec) => ({
        spec,
        scene: sources[spec.assetId].clone(true),
        node: null,
      })),
    [sources],
  );

const advanceCell = (cell: HorizonCell, time: number): void => {
  if (cell.node === null) return;
  const angle = cell.spec.initialAngle + cell.spec.angularVelocity * time;
  cell.node.position.set(
    cell.spec.orbitRadius * Math.cos(angle),
    cell.spec.y,
    cell.spec.orbitRadius * Math.sin(angle),
  );
};

export const Asteroids = (): JSX.Element => {
  const sources = useHorizonSources();
  const cells = useHorizonCells(sources);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    for (const cell of cells) advanceCell(cell, time);
  });
  return (
    <group>
      {cells.map((cell, i) => (
        <HorizonBodyView
          key={i}
          spec={cell.spec}
          scene={cell.scene}
          meshRef={(node) => {
            cell.node = node;
          }}
        />
      ))}
    </group>
  );
};

for (const path of Object.values(ASTEROID_PATHS)) useGLTF.preload(path);
