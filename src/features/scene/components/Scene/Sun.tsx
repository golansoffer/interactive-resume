import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Object3D,
  type ShaderMaterial,
} from 'three';
import {
  PLANET_PATHS,
  COLORSHEET_PATH,
  configureColorsheet,
} from '../../services/renderer/planetAssets';
import { extractBody } from '../../services/renderer/planetVisualPlan';
import {
  createSunCoronaMaterial,
  createSunHaloMaterial,
} from '../../services/renderer/sunMaterial';
import { sunAnimationAt } from '../../services/renderer/sunAnimation';
import type { SunCollider } from './useSceneRefs';

type SunProps = {
  readonly sunColliderRef: RefObject<SunCollider>;
};

// Sun sits well outside the planet ring (radius 80) on the same horizontal
// plane (y = 0) the ship and planets occupy, so flying straight at the sun
// would pierce its center rather than pass under it. From inside the ring
// the sun reads as a distant beacon; the corona/halo billboards never
// overlap the gameplay area on screen.
const SUN_POSITION: readonly [number, number, number] = [180, 0, -320];
// Scaled up from the original 5×-planets to compensate for distance — at
// ~367 world units away, this reads as a large but clearly-distant sun.
const SUN_BODY_SCALE = 15;
const CORONA_SCALE_OF_DIAMETER = 1.5;
const HALO_SCALE_OF_DIAMETER = 3.5;

const SUN_EMISSIVE_HEX = 0xffe9b0;
const SUN_EMISSIVE_INTENSITY = 1.2;

// Clones the GLB scene and replaces each MeshStandardMaterial with a cloned
// copy carrying the warm emissive override. Cloning is required because
// useGLTF caches and shares the source scene across consumers; mutating in
// place would leak into any future second consumer of the same GLB.
// Matches the cloneAndDress discipline in planetVisualPlan.ts.
const cloneAndOverride = (source: Object3D): Object3D => {
  const cloned = source.clone();
  cloned.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    if (!(obj.material instanceof MeshStandardMaterial)) return;
    const m = obj.material.clone();
    m.emissive = new Color(SUN_EMISSIVE_HEX);
    m.emissiveIntensity = SUN_EMISSIVE_INTENSITY;
    m.toneMapped = false;
    obj.material = m;
  });
  return cloned;
};

type Billboard = { readonly mesh: Mesh; readonly material: ShaderMaterial };

// Billboards live OUTSIDE the body's scaled group, so we size them in world
// units directly: world diameter = bodyRadiusLocal * 2 * SUN_BODY_SCALE * scale.
const makeBillboard = (material: ShaderMaterial, worldDiameter: number): Billboard => {
  const geometry = new PlaneGeometry(worldDiameter, worldDiameter);
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 1;
  return { mesh, material };
};

// Uniform names live in a string-indexed map (Three's design — the type
// system's actual blind spot). We narrow at read time and throw on missing
// keys. This is the parse-boundary pattern, not a defensive runtime check
// on typed values.
const setOpacityScale = (material: ShaderMaterial, value: number): void => {
  const u = material.uniforms['uOpacityScale'];
  if (u === undefined) throw new Error('uOpacityScale uniform missing on sun material');
  u.value = value;
};

const useSunFrame = (
  bodyRef: RefObject<Object3D | null>,
  corona: Billboard,
  halo: Billboard,
): void => {
  useFrame((state) => {
    const body = bodyRef.current;
    const animation = sunAnimationAt(state.clock.elapsedTime);
    if (body !== null) body.rotation.y = animation.bodyRotationY;
    setOpacityScale(corona.material, animation.coronaOpacityScale);
    setOpacityScale(halo.material, animation.haloOpacityScale);
    corona.mesh.quaternion.copy(state.camera.quaternion);
    halo.mesh.quaternion.copy(state.camera.quaternion);
  });
};

export const Sun = (props: SunProps): JSX.Element => {
  const { scene } = useGLTF(PLANET_PATHS['sun_b']);
  const colorsheet = useTexture(COLORSHEET_PATH);

  const prepared = useMemo(() => {
    configureColorsheet(colorsheet);
    return cloneAndOverride(scene);
  }, [scene, colorsheet]);

  const extraction = useMemo(() => extractBody(prepared), [prepared]);
  const bodyRadiusLocal = extraction.kind === 'no_body' ? 0 : extraction.radius;
  const worldRadius = bodyRadiusLocal * SUN_BODY_SCALE;
  const worldDiameter = worldRadius * 2;

  props.sunColliderRef.current.write({
    center: { x: SUN_POSITION[0], y: SUN_POSITION[1], z: SUN_POSITION[2] },
    radius: worldRadius,
  });

  const corona = useMemo(
    () => makeBillboard(createSunCoronaMaterial(), worldDiameter * CORONA_SCALE_OF_DIAMETER),
    [worldDiameter],
  );
  const halo = useMemo(
    () => makeBillboard(createSunHaloMaterial(), worldDiameter * HALO_SCALE_OF_DIAMETER),
    [worldDiameter],
  );

  const bodyRef = useRef<Object3D | null>(null);
  useSunFrame(bodyRef, corona, halo);

  return (
    <group position={SUN_POSITION}>
      <group ref={bodyRef} scale={[SUN_BODY_SCALE, SUN_BODY_SCALE, SUN_BODY_SCALE]}>
        <primitive object={prepared} />
      </group>
      <primitive object={corona.mesh} />
      <primitive object={halo.mesh} />
    </group>
  );
};
