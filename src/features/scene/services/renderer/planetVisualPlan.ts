import { BackSide, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Material, Object3D, Texture } from 'three';
import { computeBandNormal } from './bandNormal';
import { createPlanetAtmosphereMaterial } from './planetAtmosphereMaterial';
import type {
  AtmospherePlan,
  BodyExtraction,
  ClonedScene,
  PlanetLook,
  PlanetVisualPlan,
  PoleDirection,
  RimSpec,
} from './planetTypes';

type Candidate = {
  readonly mesh: Mesh;
  readonly radius: number;
  readonly sphericity: number;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
};

// Silhouette outline. A slightly-inflated shell of the body geometry,
// rendered with BackSide so the body's own depth occludes everything
// except the rim around the silhouette — classic NPR outline. Always-on,
// never animated. Sits at radius 1.025 (well inside the active rim's
// 1.12–1.14) so it reads as the planet's own edge, not a halo. Additive
// active rim brightens over it naturally; outline reads clean at rest.
const OUTLINE_SCALE = 1.025;
const OUTLINE_OPACITY = 0.55;
const OUTLINE_COLOR = 0x080808;

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
  if (g.boundingBox === null) g.computeBoundingBox();
  const box = g.boundingBox;
  if (box === null) return null;
  const dx = box.max.x - box.min.x;
  const dy = box.max.y - box.min.y;
  const dz = box.max.z - box.min.z;
  const maxDim = Math.max(dx, dy, dz);
  const minDim = Math.min(dx, dy, dz);
  const sphericity = maxDim === 0 ? 0 : minDim / maxDim;
  // Body radius = half the smallest bbox dimension. Robust across spherical
  // bodies, merged single-mesh ringed bodies (rings inflate two axes; the
  // third holds the body's thickness), and slightly squashed bodies. The
  // alternative — `geometry.boundingSphere.radius` — is unreliable here:
  // GLTFLoader pre-seeds it from accessor min/max as the bbox half-diagonal
  // (e.g. ~8.5 for a ~10-unit cube bbox), and even after explicit
  // computeBoundingSphere() the rings still extend max-vertex-distance well
  // past the body on Saturn and Uranus (single-mesh planets here).
  return { mesh, radius: minDim / 2, sphericity, dx, dy, dz };
};

// Fallback pole direction from bounding-box dims: a cardinal unit vector
// along the smallest dim. Used when band-normal detection has no UV data to
// read — its values can be unreliable on perfectly spherical meshes
// (Jupiter_b sphericity ~0.99999 has dims agreeing to 7 decimals so the
// comparison reduces to float-rounding noise), but it's the only signal
// left when the mesh carries no bands.
const poleDirectionFromDims = (
  dx: number,
  dy: number,
  dz: number,
): PoleDirection => {
  if (dx <= dy && dx <= dz) return [1, 0, 0];
  if (dy <= dx && dy <= dz) return [0, 1, 0];
  return [0, 0, 1];
};

// Visual pole direction for a mesh, in mesh-local space. The colour bands
// authored into the model's UVs are the planet's "north–south" — bands wrap
// around the pole. PCA on each band's face centroids yields a band normal;
// aggregated across bands that's the pole direction. Falls back to the
// bbox-dim cardinal direction only when the mesh has no UV data.
const poleDirectionForMesh = (
  mesh: Mesh,
  dx: number,
  dy: number,
  dz: number,
): PoleDirection => {
  const banded = computeBandNormal(mesh);
  if (banded.kind === 'detected') return banded.direction;
  return poleDirectionFromDims(dx, dy, dz);
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
  // as siblings in the scene graph. The disc's smallest bbox dim is the ring
  // normal — for that path we use the cardinal direction (no body to PCA).
  const disc = pickRingDisc(candidates);
  if (spherical.length > 0 && disc.kind === 'found') {
    const poleDirection = poleDirectionFromDims(disc.dx, disc.dy, disc.dz);
    return { kind: 'ringed_body', mesh: best.mesh, radius: best.radius, poleDirection };
  }
  // Single-mesh case: body + ring baked into one mesh. The bands wrap around
  // the same axis the ring's normal points along, so the band normal *is*
  // the pole direction.
  if (best.sphericity <= SPHERICITY_THRESHOLD) {
    const poleDirection = poleDirectionForMesh(best.mesh, best.dx, best.dy, best.dz);
    return { kind: 'ringed_body', mesh: best.mesh, radius: best.radius, poleDirection };
  }
  // Non-ringed body: pole direction is the model-space band normal — the
  // exact axis the colour bands wrap around, not a cardinal-axis snap.
  const poleDirection = poleDirectionForMesh(best.mesh, best.dx, best.dy, best.dz);
  return { kind: 'body', mesh: best.mesh, radius: best.radius, poleDirection };
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
    m.emissiveMap = texture;
    // Every PlanetLook variant carries a pulse — the body emissive is
    // always tinted by pulse.emissiveTint, and intensity is driven every
    // frame by animatePulse. Initial intensity 0 is a placeholder that
    // animatePulse overwrites on the first frame.
    const [r, g, b] = look.pulse.emissiveTint;
    m.emissive = new Color(r, g, b);
    m.emissiveIntensity = 0;
    m.needsUpdate = true;
    obj.material = m;
    standardMaterials.push(m);
  });
  return { scene: cloned, extraction: extractBody(cloned), standardMaterials };
};

// Builds a shell-mesh child for a planet body — geometry cloned from the
// body, re-centered on the body's bounding-sphere origin (so uniform
// scaling expands evenly), smoothed normals (kills flat-shading silhouette
// discontinuities that would otherwise read as sharp lines on the shell).
// Material, scale, and renderOrder are caller-supplied because the two
// callers (outline and atmosphere) need different materials and different
// distances past the body. The mesh is added as a child of the body and
// returned for any additional caller-side configuration.
const attachShell = (
  body: Mesh,
  material: Material,
  scale: number,
  renderOrder: number,
): Mesh => {
  const sphere = body.geometry.boundingSphere;
  if (sphere === null) {
    throw new Error('attachShell: body geometry has no bounding sphere');
  }
  const geometry = body.geometry.clone();
  geometry.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, material);
  mesh.position.copy(sphere.center);
  mesh.scale.setScalar(scale);
  mesh.renderOrder = renderOrder;
  body.add(mesh);
  return mesh;
};

// Attaches an outline shell to the body. Uniform near-black color at low
// opacity; back-side rendering so the body's own depth occludes everything
// except the rim around the silhouette (classic NPR outline). Always-on,
// never animated. Sits inside the active rim's scale so it reads as the
// planet's own edge, not a halo; the additive active rim brightens over
// it naturally when the planet activates.
export const attachOutline = (body: Mesh): void => {
  const material = new MeshBasicMaterial({
    color: OUTLINE_COLOR,
    side: BackSide,
    transparent: true,
    opacity: OUTLINE_OPACITY,
    depthWrite: false,
  });
  attachShell(body, material, OUTLINE_SCALE, 0);
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
  const material = createPlanetAtmosphereMaterial({
    tint: rim.tint,
    power: rim.power,
    opacity: rim.opacity,
    phase,
  });
  const mesh = attachShell(body, material, rim.scale, 1);

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
  if (cloned.extraction.kind === 'no_body' || mats.length === 0) {
    return { kind: 'no_body', scene };
  }
  attachOutline(cloned.extraction.mesh);
  if (look.kind === 'body_only') {
    return { kind: 'body_only', scene, pulse: look.pulse, standardMaterials: mats };
  }
  return {
    kind: 'body_and_rim',
    scene,
    pulse: look.pulse,
    atmosphere: attachAtmosphere(cloned.extraction.mesh, look.rim, phase),
    standardMaterials: mats,
  };
};

