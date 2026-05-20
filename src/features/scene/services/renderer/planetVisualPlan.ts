import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { Object3D, Texture } from 'three';
import { createPlanetAtmosphereMaterial } from './planetAtmosphereMaterial';
import type {
  AtmospherePlan,
  BodyExtraction,
  ClonedScene,
  PlanetLook,
  PlanetVisualPlan,
  RimSpec,
  RingNormalAxis,
} from './planetTypes';

type Candidate = {
  readonly mesh: Mesh;
  readonly radius: number;
  readonly sphericity: number;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
};

const ROTATION_RAD_PER_SEC_BASE = 0.07;
const ROTATION_VARIANCE = 0.25;

// Mesh whose bounding-box minDim/maxDim is below this is treated as a flat
// feature (e.g. Saturn's rings disc) and skipped when picking the body.
// Calibrated against the planet asset set: pure spheres land at 0.97–0.99,
// merged-mesh ringed bodies (Saturn ~0.59, Uranus ~0.45) land well below 0.8.
const SPHERICITY_THRESHOLD = 0.8;

export const rotationRateFor = (phase: number): number =>
  ROTATION_RAD_PER_SEC_BASE * (1 + ROTATION_VARIANCE * Math.sin(phase));

const computeCandidate = (mesh: Mesh): Candidate | null => {
  const g = mesh.geometry;
  if (g.boundingSphere === null) g.computeBoundingSphere();
  if (g.boundingBox === null) g.computeBoundingBox();
  const sphere = g.boundingSphere;
  const box = g.boundingBox;
  if (sphere === null || box === null) return null;
  const dx = box.max.x - box.min.x;
  const dy = box.max.y - box.min.y;
  const dz = box.max.z - box.min.z;
  const maxDim = Math.max(dx, dy, dz);
  const minDim = Math.min(dx, dy, dz);
  const sphericity = maxDim === 0 ? 0 : minDim / maxDim;
  return { mesh, radius: sphere.radius, sphericity, dx, dy, dz };
};

// Picks the axis of the smallest bounding-box dimension. A ring disc has a
// flat normal axis (its thinnest dimension), which is the rotation axis we
// need to align with the planet's spin axis. Exhaustive: any three numbers
// produce one of 'x' | 'y' | 'z'.
const ringNormalAxisFromDims = (dx: number, dy: number, dz: number): RingNormalAxis => {
  if (dx <= dy && dx <= dz) return 'x';
  if (dy <= dx && dy <= dz) return 'y';
  return 'z';
};

type RingDisc =
  | { readonly kind: 'none' }
  | { readonly kind: 'found'; readonly dx: number; readonly dy: number; readonly dz: number };

// Selects the largest non-spherical candidate (by its broadest dimension —
// the disc's outer extent). Absence is folded into the 'none' variant so the
// caller narrows by `kind`, never by `T | undefined` on the array lookup.
const pickRingDisc = (candidates: ReadonlyArray<Candidate>): RingDisc => {
  let best: RingDisc = { kind: 'none' };
  for (const c of candidates) {
    if (c.sphericity > SPHERICITY_THRESHOLD) continue;
    const extent = Math.max(c.dx, c.dy, c.dz);
    if (best.kind === 'none' || extent > Math.max(best.dx, best.dy, best.dz)) {
      best = { kind: 'found', dx: c.dx, dy: c.dy, dz: c.dz };
    }
  }
  return best;
};

// Picks the most spherical descendant Mesh — for Saturn (body + flat rings),
// this filters the rings out and picks the body. For single-mesh planets,
// picks the only mesh. Falls back to largest overall if no mesh clears the
// sphericity threshold.
export const extractBody = (root: Object3D): BodyExtraction => {
  const candidates: Array<Candidate> = [];
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const cand = computeCandidate(obj);
    if (cand !== null) candidates.push(cand);
  });
  const spherical = candidates.filter((c) => c.sphericity > SPHERICITY_THRESHOLD);
  const pool = spherical.length > 0 ? spherical : candidates;
  const best = pool.reduce<Candidate | null>(
    (acc, c) => (acc === null || c.radius > acc.radius ? c : acc),
    null,
  );
  if (best === null) return { kind: 'no_body' };
  // Multi-mesh case: a separate spherical body coexists with a flat ring disc
  // as siblings in the scene graph.
  const disc = pickRingDisc(candidates);
  if (spherical.length > 0 && disc.kind === 'found') {
    const ringNormalAxis = ringNormalAxisFromDims(disc.dx, disc.dy, disc.dz);
    return { kind: 'ringed_body', mesh: best.mesh, radius: best.radius, ringNormalAxis };
  }
  // Single-mesh case: body + ring are baked into one mesh (this asset set).
  // The merged mesh is non-spherical because the ring extends beyond the body
  // in its plane; the smallest bbox dim points along the ring normal.
  if (best.sphericity <= SPHERICITY_THRESHOLD) {
    const ringNormalAxis = ringNormalAxisFromDims(best.dx, best.dy, best.dz);
    return { kind: 'ringed_body', mesh: best.mesh, radius: best.radius, ringNormalAxis };
  }
  return { kind: 'body', mesh: best.mesh, radius: best.radius };
};

export const cloneAndDress = (
  source: Object3D,
  texture: Texture,
  look: PlanetLook,
): ClonedScene => {
  const cloned = source.clone();
  const standardMaterials: Array<MeshStandardMaterial> = [];
  cloned.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    if (!(obj.material instanceof MeshStandardMaterial)) return;
    const m = obj.material.clone();
    m.map = texture;
    m.roughness = 1.0;
    m.metalness = 0.0;
    m.flatShading = true;
    if (look.kind === 'effects') {
      const [r, g, b] = look.pulse.emissiveTint;
      m.emissiveMap = texture;
      m.emissive = new Color(r, g, b);
      m.emissiveIntensity = 0;
    }
    m.needsUpdate = true;
    obj.material = m;
    standardMaterials.push(m);
  });
  return { scene: cloned, extraction: extractBody(cloned), standardMaterials };
};

// Mutates the cloned scene: attaches a shell mesh as a child of the body
// mesh, so the rim inherits the body's local transform automatically. The
// shell re-uses the body's own geometry (cloned) so the rim follows the
// planet's actual silhouette, then re-computes smooth (averaged) vertex
// normals — this kills per-face flat-shading discontinuities that would
// otherwise propagate to the fresnel rim as sharp lines. The clone is also
// re-centered on its bounding-sphere center so uniform scaling expands the
// rim evenly around the body content, not from an arbitrary local origin.
const attachAtmosphere = (body: Mesh, rim: RimSpec, phase: number): AtmospherePlan => {
  const sphere = body.geometry.boundingSphere;
  if (sphere === null) {
    throw new Error('attachAtmosphere: body geometry has no bounding sphere');
  }
  const geometry = body.geometry.clone();
  geometry.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
  geometry.computeVertexNormals();
  const material = createPlanetAtmosphereMaterial({
    tint: rim.tint,
    power: rim.power,
    opacity: rim.opacity,
    phase,
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.copy(sphere.center);
  mesh.scale.setScalar(rim.scale);
  body.add(mesh);

  const opacityUniform = material.uniforms['uOpacity'];
  const timeUniform = material.uniforms['uTime'];
  if (opacityUniform === undefined || timeUniform === undefined) {
    throw new Error('createPlanetAtmosphereMaterial missing uOpacity or uTime uniform');
  }
  return {
    opacityUniform,
    timeUniform,
    baseOpacity: rim.opacity,
    breath: rim.breath,
    rimMesh: mesh,
    baseScale: rim.scale,
    scalePulse: rim.scalePulse,
  };
};

export const buildVisualPlan = (
  look: PlanetLook,
  cloned: ClonedScene,
  phase: number,
): PlanetVisualPlan => {
  const scene = cloned.scene;
  const mats = cloned.standardMaterials;
  if (look.kind === 'plain') return { kind: 'plain', scene };
  if (cloned.extraction.kind === 'no_body' || mats.length === 0) {
    return { kind: 'plain', scene };
  }
  return {
    kind: 'effects',
    scene,
    atmosphere: attachAtmosphere(cloned.extraction.mesh, look.rim, phase),
    pulse: look.pulse,
    standardMaterials: mats,
  };
};

