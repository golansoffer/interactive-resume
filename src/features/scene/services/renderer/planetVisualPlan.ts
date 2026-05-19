import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { IUniform, Object3D, Texture } from 'three';
import { createPlanetAtmosphereMaterial } from './planetAtmosphereMaterial';

export type IdleBreath = {
  readonly amplitude: number;
  readonly frequencyHz: number;
};

export type RimSpec = {
  readonly tint: readonly [number, number, number];
  readonly power: number;
  readonly opacity: number;
  readonly scale: number;
  readonly breath: IdleBreath;
};

export type PulseSpec = {
  readonly amplitude: number;
  readonly frequencyHz: number;
  readonly emissiveTint: readonly [number, number, number];
};

// PlanetLook is the per-asset configured effect bundle. Every "looking"
// planet carries both a body pulse (the baseline aliveness — always on) and
// a rim (gated on activation by an external 0..1 factor at animation time).
// Unconfigured asset ids resolve to 'plain' (no effects).
export type PlanetLook =
  | { readonly kind: 'plain' }
  | { readonly kind: 'effects'; readonly pulse: PulseSpec; readonly rim: RimSpec };

export type BodyExtraction =
  | { readonly kind: 'no_body' }
  | { readonly kind: 'body'; readonly mesh: Mesh; readonly radius: number };

type AtmospherePlan = {
  readonly opacityUniform: IUniform<number>;
  readonly timeUniform: IUniform<number>;
  readonly baseOpacity: number;
  readonly breath: IdleBreath;
};

export type PlanetVisualPlan =
  | { readonly kind: 'plain'; readonly scene: Object3D }
  | {
      readonly kind: 'effects';
      readonly scene: Object3D;
      readonly atmosphere: AtmospherePlan;
      readonly pulse: PulseSpec;
      readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
    };

export type ClonedScene = {
  readonly scene: Object3D;
  readonly extraction: BodyExtraction;
  readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
};

type Candidate = {
  readonly mesh: Mesh;
  readonly radius: number;
  readonly sphericity: number;
};

const ROTATION_RAD_PER_SEC_BASE = 0.07;
const ROTATION_VARIANCE = 0.25;
const TWO_PI = Math.PI * 2;

// Mesh whose bounding-box minDim/maxDim is below this is treated as a flat
// feature (e.g. Saturn's rings disc) and skipped when picking the body.
const SPHERICITY_THRESHOLD = 0.5;

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
  return { mesh, radius: sphere.radius, sphericity };
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
  return { opacityUniform, timeUniform, baseOpacity: rim.opacity, breath: rim.breath };
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

// Applies per-frame mutations to the visual plan:
// - Body pulse (warm emissive breathing) runs ALWAYS for any planet with
//   effects — this is the baseline "alive" cue, independent of activation.
// - Rim opacity, idle rim breath, and shader time are written every frame
//   but multiplied by activationFactor (0..1). The rim fades in/out smoothly
//   when the caller lerps activationFactor on proximity enter/exit.
export const animatePlan = (
  plan: PlanetVisualPlan,
  time: number,
  phase: number,
  activationFactor: number,
): void => {
  if (plan.kind === 'plain') return;

  const { amplitude, frequencyHz } = plan.pulse;
  const pulseT = (Math.sin(time * frequencyHz * TWO_PI + phase) + 1) * 0.5;
  const intensity = amplitude * pulseT;
  for (const m of plan.standardMaterials) m.emissiveIntensity = intensity;

  const { breath, baseOpacity, opacityUniform, timeUniform } = plan.atmosphere;
  const breathT = (Math.sin(time * breath.frequencyHz * TWO_PI + phase * 0.6) + 1) * 0.5;
  const breathFactor = 1 - breath.amplitude * 0.5 + breath.amplitude * breathT;
  opacityUniform.value = baseOpacity * breathFactor * activationFactor;
  timeUniform.value = time;
};
