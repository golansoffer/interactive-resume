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

// 5× PLANET_BASE_SCALE (1.5)
const SUN_BODY_SCALE = 7.5;
const CORONA_SCALE_OF_DIAMETER = 1.5;
const HALO_SCALE_OF_DIAMETER = 3.5;

const SUN_LIGHT_COLOR = '#ffcf8f';
const SUN_LIGHT_INTENSITY = 120;
const SUN_LIGHT_DISTANCE = 45;
const SUN_LIGHT_DECAY = 2;

const SUN_EMISSIVE_HEX = 0xffe9b0;
const SUN_EMISSIVE_INTENSITY = 1.2;

// Applies the warm emissive override to every MeshStandardMaterial on the
// sun body so the sphere reads as a hot source under any tone-mapping setup.
const overrideSunMaterials = (root: Object3D): void => {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.emissive = new Color(SUN_EMISSIVE_HEX);
      material.emissiveIntensity = SUN_EMISSIVE_INTENSITY;
      material.toneMapped = false;
    }
  });
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
    overrideSunMaterials(scene);
    return scene;
  }, [scene, colorsheet]);

  const extraction = useMemo(() => extractBody(prepared), [prepared]);
  const bodyRadiusLocal = extraction.kind === 'no_body' ? 0 : extraction.radius;
  const worldRadius = bodyRadiusLocal * SUN_BODY_SCALE;
  const worldDiameter = worldRadius * 2;

  props.sunColliderRef.current.write({
    center: { x: 0, y: 0, z: 0 },
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
    <group position={[0, 0, 0]}>
      <pointLight
        color={SUN_LIGHT_COLOR}
        intensity={SUN_LIGHT_INTENSITY}
        distance={SUN_LIGHT_DISTANCE}
        decay={SUN_LIGHT_DECAY}
        castShadow={false}
      />
      <group ref={bodyRef} scale={[SUN_BODY_SCALE, SUN_BODY_SCALE, SUN_BODY_SCALE]}>
        <primitive object={prepared} />
      </group>
      <primitive object={corona.mesh} />
      <primitive object={halo.mesh} />
    </group>
  );
};
