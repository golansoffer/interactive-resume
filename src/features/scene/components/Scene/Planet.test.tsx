import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { extractBody } from '../../services/renderer/planetVisualPlan';
import { resolvePlanetLook } from './Planet';

describe('resolvePlanetLook', () => {
  it('returns effects for earth_b with both pulse and rim and a cool blue rim tint', () => {
    const look = resolvePlanetLook('earth_b');
    expect(look.kind).toBe('effects');
    if (look.kind !== 'effects') throw new Error('expected effects variant');
    expect(look.rim.tint).toEqual([0.18, 0.72, 1.0]);
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
    expect(look.rim.tint).toEqual([1.0, 0.62, 0.18]);
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
    expect(look.pulse.amplitude).toBeCloseTo(0.35);
    expect(look.pulse.emissiveTint).toEqual([1.0, 0.42, 0.18]);
    const [r, g, b] = look.pulse.emissiveTint;
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it('returns plain for an unconfigured asset id', () => {
    expect(resolvePlanetLook('mercury_a')).toEqual({ kind: 'plain' });
    expect(resolvePlanetLook('jupiter_b')).toEqual({ kind: 'plain' });
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

  it('prefers a spherical body over a flat disc with a larger bounding sphere', () => {
    const root = new Group();
    const bodyMesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    const ringMesh = new Mesh(new BoxGeometry(10, 0.05, 10), new MeshBasicMaterial());
    root.add(bodyMesh);
    root.add(ringMesh);
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    if (result.kind !== 'body') throw new Error('expected body variant');
    expect(result.mesh).toBe(bodyMesh);
  });

  it('picks the single mesh when there is only one', () => {
    const root = new Group();
    const mesh = new Mesh(new SphereGeometry(2, 8, 8), new MeshBasicMaterial());
    root.add(mesh);
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    if (result.kind !== 'body') throw new Error('expected body variant');
    expect(result.mesh).toBe(mesh);
  });

  it('computes bounding sphere when null on the geometry', () => {
    const root = new Group();
    const geometry = new BoxGeometry(3, 3, 3);
    geometry.boundingSphere = null;
    root.add(new Mesh(geometry, new MeshBasicMaterial()));
    const result = extractBody(root);
    expect(result.kind).toBe('body');
    expect(geometry.boundingSphere).not.toBeNull();
  });
});
