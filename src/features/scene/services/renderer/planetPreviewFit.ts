import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';

export type PlanetPreviewFit = {
  readonly kind: 'planet_preview_fit';
  readonly translation: readonly [number, number, number];
  readonly uniformScale: number;
};

const IDENTITY_FIT: PlanetPreviewFit = {
  kind: 'planet_preview_fit',
  translation: [0, 0, 0],
  uniformScale: 1,
};

// Returns the (translation, uniformScale) pair that, applied as parent transforms
// outside a `<group quaternion={alignQuaternion}>` wrapper, centers the aligned
// model on the origin and scales its widest post-alignment extent to 1 unit.
// The alignment is applied to the AABB rather than to the scene graph itself,
// so this is safe to call without mutating the scene — the resulting AABB is
// an axis-aligned wrap of the rotated original box, the exact extent the child
// group will occupy once R3F applies the quaternion at render time.
export const computePlanetPreviewFit = (
  scene: Object3D,
  alignQuaternion: readonly [number, number, number, number],
): PlanetPreviewFit => {
  scene.updateMatrixWorld(true);
  const localBox = new Box3().setFromObject(scene, true);
  if (localBox.isEmpty()) return IDENTITY_FIT;

  const [qx, qy, qz, qw] = alignQuaternion;
  const rotation = new Matrix4().makeRotationFromQuaternion(
    new Quaternion(qx, qy, qz, qw),
  );
  const rotatedBox = localBox.clone().applyMatrix4(rotation);

  const center = rotatedBox.getCenter(new Vector3());
  const size = rotatedBox.getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return IDENTITY_FIT;

  return {
    kind: 'planet_preview_fit',
    translation: [-center.x, -center.y, -center.z],
    uniformScale: 1 / maxDim,
  };
};
