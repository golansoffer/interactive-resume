import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { Object3D } from 'three';

export type DressedShip = {
  readonly scene: Object3D;
  readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
};

// Cyan accent matches the ship trail color so engine glow reads as one
// visual element with the trail behind the ship.
const ACCENT_EMISSIVE_HEX = 0x5fd6ff;
const ACCENT_EMISSIVE_INTENSITY = 0.95;
const HULL_EMISSIVE_INTENSITY = 0.025;

export const cloneAndDressShip = (source: Object3D): DressedShip => {
  const cloned = source.clone();
  const standardMaterials: Array<MeshStandardMaterial> = [];
  cloned.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    if (!(obj.material instanceof MeshStandardMaterial)) return;
    const m = obj.material.clone();
    m.flatShading = true;
    const hasAccent = m.emissiveMap !== null;
    m.emissive = new Color(ACCENT_EMISSIVE_HEX);
    m.emissiveIntensity = hasAccent ? ACCENT_EMISSIVE_INTENSITY : HULL_EMISSIVE_INTENSITY;
    m.needsUpdate = true;
    obj.material = m;
    standardMaterials.push(m);
  });
  return { scene: cloned, standardMaterials };
};
