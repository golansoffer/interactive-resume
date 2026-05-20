import { describe, expect, it } from 'vitest';
import { Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { planetCollider } from './planetCollider';
import type { BodyExtraction } from './planetTypes';

const dummyMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

describe('planetCollider', () => {
  it('returns radius 0 for a no_body extraction so clampOutOfSphere no-ops', () => {
    const extraction: BodyExtraction = { kind: 'no_body' };
    const sphere = planetCollider(extraction, [10, 0, -20], 1.5);
    expect(sphere.radius).toBe(0);
    expect(sphere.center).toEqual({ x: 10, y: 0, z: -20 });
  });

  it('multiplies the extracted body radius by the scale factor for a body extraction', () => {
    const extraction: BodyExtraction = {
      kind: 'body',
      mesh: dummyMesh,
      radius: 4,
      poleDirection: [0, 1, 0],
    };
    const sphere = planetCollider(extraction, [0, 0, 0], 1.5);
    expect(sphere.radius).toBeCloseTo(6, 6);
  });

  it('multiplies the extracted body radius by the scale factor for a ringed_body extraction (rings excluded)', () => {
    const extraction: BodyExtraction = {
      kind: 'ringed_body',
      mesh: dummyMesh,
      radius: 1,
      poleDirection: [0, 1, 0],
    };
    const sphere = planetCollider(extraction, [80, 0, 0], 1.5);
    expect(sphere.radius).toBeCloseTo(1.5, 6);
    expect(sphere.center).toEqual({ x: 80, y: 0, z: 0 });
  });

  it('center is the placement tuple expressed as a Vec3 — independent of extraction kind', () => {
    const extraction: BodyExtraction = { kind: 'no_body' };
    expect(planetCollider(extraction, [1, 2, 3], 1.5).center).toEqual({ x: 1, y: 2, z: 3 });
  });
});
