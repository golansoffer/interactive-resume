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
} from 'three';
import {
  PLANET_PATHS,
  COLORSHEET_PATH,
  configureColorsheet,
} from '../../services/renderer/planetAssets';
import { extractBody } from '../../services/renderer/planetVisualPlan';
import { planetCollider } from '../../services/renderer/planetCollider';
import {
  createSunCoronaMaterial,
  createSunHaloMaterial,
  type SunBillboardMaterial,
} from '../../services/renderer/sunMaterial';
import { sunAnimationAt } from '../../services/renderer/sunAnimation';
import type { SphereColliders } from '../../types/scene-refs';

type SunProps = {
  readonly sphereCollidersRef: RefObject<SphereColliders>;
};

// On the curve's far axis past Venus; anchors the rightward arc.
const SUN_POSITION: readonly [number, number, number] = [-280, 0, 1150];
// Scaled up from the original 5×-planets to compensate for distance — at
// ~367 world units away, this reads as a large but clearly-distant sun.
const SUN_BODY_SCALE = 17;
const CORONA_SCALE_OF_DIAMETER = 1.5;
const HALO_SCALE_OF_DIAMETER = 4.5;

// Emissive intensity tuned to feel sun-bright while still letting the
// colorsheet texture read on the body — full-bright washes the surface,
// too low feels dim.
const SUN_EMISSIVE_HEX = 0xffe9b0;
const SUN_EMISSIVE_INTENSITY = 0.9;

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

type Billboard = { readonly mesh: Mesh; readonly billboard: SunBillboardMaterial };

// Billboards live OUTSIDE the body's scaled group, so we size them in world
// units directly: world diameter = bodyRadiusLocal * 2 * SUN_BODY_SCALE * scale.
const makeBillboard = (billboard: SunBillboardMaterial, worldDiameter: number): Billboard => {
  const geometry = new PlaneGeometry(worldDiameter, worldDiameter);
  const mesh = new Mesh(geometry, billboard.material);
  mesh.renderOrder = 1;
  return { mesh, billboard };
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
    corona.billboard.setOpacityScale(animation.coronaOpacityScale);
    halo.billboard.setOpacityScale(animation.haloOpacityScale);
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
  const sphere = useMemo(
    () => planetCollider(extraction, SUN_POSITION, SUN_BODY_SCALE),
    [extraction],
  );
  const worldDiameter = sphere.radius * 2;

  props.sphereCollidersRef.current.register('sun', sphere);

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
