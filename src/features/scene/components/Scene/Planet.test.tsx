import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { extractBody } from '../../services/renderer/planetVisualPlan';
import { resolvePlanetLook } from '../../services/renderer/planetAssets';

describe('resolvePlanetLook', () => {
  it('returns effects for jupiter_b with both pulse and rim and a warm cream rim tint', () => {
    const look = resolvePlanetLook('jupiter_b');
    expect(look.kind).toBe('effects');
    if (look.kind !== 'effects') throw new Error('expected effects variant');
    expect(look.rim.tint).toEqual([1.0, 0.65, 0.28]);
    expect(look.rim.scale).toBeGreaterThan(1);
    expect(look.rim.opacity).toBeGreaterThan(0);
    expect(look.rim.breath.amplitude).toBeGreaterThan(0);
    expect(look.rim.breath.frequencyHz).toBeGreaterThan(0);
    expect(look.pulse.amplitude).toBeGreaterThan(0);
    expect(look.pulse.frequencyHz).toBeGreaterThan(0);
    expect(look.pulse.emissiveTint).toHaveLength(3);
  });

  it('returns effects for saturn_b with warm gold rim tint and a pulse emissive tint', () => {
    const look = resolvePlanetLook('saturn_b');
    expect(look.kind).toBe('effects');
    if (look.kind !== 'effects') throw new Error('expected effects variant');
    expect(look.rim.tint).toEqual([1.0, 0.5, 0.08]);
    expect(look.rim.breath.frequencyHz).toBeGreaterThan(0);
    expect(look.pulse.frequencyHz).toBeGreaterThan(0);
    expect(look.pulse.amplitude).toBeGreaterThan(0);
    expect(look.pulse.emissiveTint).toHaveLength(3);
  });

  it('returns effects for mars_b with a warm pulse emissive tint preserved', () => {
    const look = resolvePlanetLook('mars_b');
    expect(look.kind).toBe('effects');
    if (look.kind !== 'effects') throw new Error('expected effects variant');
    expect(look.pulse.frequencyHz).toBeCloseTo(0.17);
    expect(look.pulse.amplitude).toBeCloseTo(0.68);
    expect(look.pulse.emissiveTint).toEqual([1.0, 0.3, 0.12]);
    const [r, g, b] = look.pulse.emissiveTint;
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it('returns plain for an unconfigured asset id', () => {
    expect(resolvePlanetLook('mercury_a')).toEqual({ kind: 'plain' });
    expect(resolvePlanetLook('earth_b')).toEqual({ kind: 'plain' });
    expect(resolvePlanetLook('neptune_b')).toEqual({ kind: 'plain' });
    expect(resolvePlanetLook('sun_a')).toEqual({ kind: 'plain' });
  });
});

describe('extractBody', () => {
  it('returns no_body for a scene with no meshes', () => {
    const root = new Group();
    expect(extractBody(root)).toEqual({ kind: 'no_body' });
  });

  it('picks the mesh with the largest bounding-sphere radius among spherical meshes', () => {
    const root = new Group();
    const smallMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const largeMesh = new Mesh(new SphereGeometry(5, 8, 8), new MeshBasicMaterial());
    root.add(smallMesh);
    root.add(largeMesh);
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    if (result.kind !== 'body') throw new Error('expected body variant');
    expect(result.mesh).toBe(largeMesh);
  });

  it('returns ringed_body when a flat disc is filtered alongside a spherical body', () => {
    const root = new Group();
    const bodyMesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    const ringMesh = new Mesh(new BoxGeometry(10, 0.05, 10), new MeshBasicMaterial());
    root.add(bodyMesh);
    root.add(ringMesh);
    const result = extractBody(root);
    expect(result.kind).toBe('ringed_body');
    if (result.kind !== 'ringed_body') throw new Error('expected ringed_body variant');
    expect(result.mesh).toBe(bodyMesh);
    // Ring disc dims are (10, 0.05, 10) → smallest axis is y → normal points
    // along local Y. Auto-detection should pick 'y'.
    expect(result.poleDirection).toEqual([0, 1, 0]);
  });

  it('detects ring normal axis on the X axis when the disc is flat in YZ', () => {
    const root = new Group();
    const bodyMesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    const ringMesh = new Mesh(new BoxGeometry(0.05, 10, 10), new MeshBasicMaterial());
    root.add(bodyMesh);
    root.add(ringMesh);
    const result = extractBody(root);
    expect(result.kind).toBe('ringed_body');
    if (result.kind !== 'ringed_body') throw new Error('expected ringed_body variant');
    expect(result.poleDirection).toEqual([1, 0, 0]);
  });

  it('detects ring normal axis on the Z axis when the disc is flat in XY', () => {
    const root = new Group();
    const bodyMesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    const ringMesh = new Mesh(new BoxGeometry(10, 10, 0.05), new MeshBasicMaterial());
    root.add(bodyMesh);
    root.add(ringMesh);
    const result = extractBody(root);
    expect(result.kind).toBe('ringed_body');
    if (result.kind !== 'ringed_body') throw new Error('expected ringed_body variant');
    expect(result.poleDirection).toEqual([0, 0, 1]);
  });

  it('picks the single mesh when there is only one', () => {
    const root = new Group();
    const mesh = new Mesh(new SphereGeometry(2, 8, 8), new MeshBasicMaterial());
    root.add(mesh);
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    if (result.kind !== 'body') throw new Error('expected body variant');
    expect(result.mesh).toBe(mesh);
    const [px, py, pz] = result.poleDirection;
    const len = Math.sqrt(px * px + py * py + pz * pz);
    expect(len).toBeCloseTo(1, 6);
  });

  it('computes bounding box when null on the geometry', () => {
    const root = new Group();
    const geometry = new BoxGeometry(3, 3, 3);
    geometry.boundingBox = null;
    root.add(new Mesh(geometry, new MeshBasicMaterial()));
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    if (result.kind !== 'body') throw new Error('expected body variant');
    expect(geometry.boundingBox).not.toBeNull();
    const [px, py, pz] = result.poleDirection;
    const len = Math.sqrt(px * px + py * py + pz * pz);
    expect(len).toBeCloseTo(1, 6);
  });

  it('detects pole axis on X for a single non-ringed body flattened along X', () => {
    const root = new Group();
    // Dims (1.0, 1.1, 1.1) → sphericity ≈ 0.91, above SPHERICITY_THRESHOLD,
    // so this lands in the 'body' variant (not 'ringed_body'). Smallest dim
    // is X, so poleAxis must be 'x'.
    const mesh = new Mesh(new BoxGeometry(1.0, 1.1, 1.1), new MeshBasicMaterial());
    root.add(mesh);
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    if (result.kind !== 'body') throw new Error('expected body variant');
    expect(result.poleDirection).toEqual([1, 0, 0]);
  });

  it('detects pole axis on Y for a single non-ringed body flattened along Y', () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(1.1, 1.0, 1.1), new MeshBasicMaterial());
    root.add(mesh);
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    if (result.kind !== 'body') throw new Error('expected body variant');
    expect(result.poleDirection).toEqual([0, 1, 0]);
  });

  it('detects pole axis on Z for a single non-ringed body flattened along Z', () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(1.1, 1.1, 1.0), new MeshBasicMaterial());
    root.add(mesh);
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    if (result.kind !== 'body') throw new Error('expected body variant');
    expect(result.poleDirection).toEqual([0, 0, 1]);
  });

  it('reports body radius as half the smallest bbox dimension on a merged ringed mesh — not the bounding-sphere half-diagonal that engulfs the rings', () => {
    // Single-mesh body+ring: bbox extends 10 units across two axes (ring outer
    // extent) and 2 units along the third (body thickness). The body's actual
    // radius is the half-thickness (1); the bounding sphere from corner
    // vertices would be sqrt(5²+1²+5²) ≈ 7.14, 7× larger, and that inflated
    // value would scale the activation zone proportionally on Uranus and
    // Saturn (both ship as single merged meshes).
    const root = new Group();
    const merged = new Mesh(new BoxGeometry(10, 2, 10), new MeshBasicMaterial());
    root.add(merged);
    const result = extractBody(root);
    expect(result.kind).toBe('ringed_body');
    if (result.kind !== 'ringed_body') throw new Error('expected ringed_body variant');
    expect(result.radius).toBeCloseTo(1, 6);
  });

  it('reports body radius as half the smallest bbox dimension on a spherical body — independent of vertex distribution', () => {
    // Even for a well-tessellated sphere mesh, the loose bounding-sphere
    // bbox-center → corner-vertex measurement can drift; minDim/2 is the
    // body radius regardless of how vertices land in the bbox.
    const root = new Group();
    const mesh = new Mesh(new SphereGeometry(5, 32, 16), new MeshBasicMaterial());
    root.add(mesh);
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    if (result.kind !== 'body') throw new Error('expected body variant');
    expect(result.radius).toBeCloseTo(5, 1);
  });
});
