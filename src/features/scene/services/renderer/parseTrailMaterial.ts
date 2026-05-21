import type { Material, Mesh } from 'three';

// Parse boundary — drei's <Trail> forwards a Mesh ref whose `material`
// field is typed `Material | Material[]` in three.js but is contractually
// a single Material for the Trail line drei builds. The array case is a
// library-contract violation, not a runtime branch we silently degrade
// through; we surface it loudly so the breakage is caught at the parse
// site (Iron Law 3 — parse, don't validate).
export const parseTrailMaterial = (mesh: Mesh): Material => {
  const mat = mesh.material;
  if (Array.isArray(mat)) {
    throw new TypeError('drei Trail produced an array material; library contract changed.');
  }
  return mat;
};
