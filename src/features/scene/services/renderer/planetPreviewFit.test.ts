import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { computePlanetPreviewFit } from './planetPreviewFit';

const makeBoxMesh = (size: number, x: number, y: number, z: number): Mesh => {
  const mesh = new Mesh(new BoxGeometry(size, size, size), new MeshBasicMaterial());
  mesh.position.set(x, y, z);
  return mesh;
};

describe('computePlanetPreviewFit — empty', () => {
  it('returns the identity fit for an empty scene', () => {
    const scene = new Group();
    const fit = computePlanetPreviewFit(scene, [0, 0, 0, 1]);
    expect(fit.translation).toEqual([0, 0, 0]);
    expect(fit.uniformScale).toBe(1);
  });
});

describe('computePlanetPreviewFit — centered unit cube', () => {
  it('returns zero translation and uniformScale = 1 / edgeLength', () => {
    const scene = new Group();
    scene.add(makeBoxMesh(2, 0, 0, 0));
    const fit = computePlanetPreviewFit(scene, [0, 0, 0, 1]);
    expect(fit.translation[0]).toBeCloseTo(0, 6);
    expect(fit.translation[1]).toBeCloseTo(0, 6);
    expect(fit.translation[2]).toBeCloseTo(0, 6);
    expect(fit.uniformScale).toBeCloseTo(0.5, 6);
  });
});

describe('computePlanetPreviewFit — off-center cube', () => {
  it('returns the negated centroid as translation', () => {
    const scene = new Group();
    scene.add(makeBoxMesh(1, 3, -2, 0.5));
    const fit = computePlanetPreviewFit(scene, [0, 0, 0, 1]);
    expect(fit.translation[0]).toBeCloseTo(-3, 6);
    expect(fit.translation[1]).toBeCloseTo(2, 6);
    expect(fit.translation[2]).toBeCloseTo(-0.5, 6);
  });
});

describe('computePlanetPreviewFit — alignment affects extents', () => {
  it('measures the post-alignment extents when the scene is rotated', () => {
    const scene = new Group();
    // A thin disc-like box: 4 × 0.1 × 4 (wide in X and Z, thin in Y)
    const mesh = new Mesh(new BoxGeometry(4, 0.1, 4), new MeshBasicMaterial());
    scene.add(mesh);

    const unaligned = computePlanetPreviewFit(scene, [0, 0, 0, 1]);
    // Identity quaternion: maxDim = 4, scale = 0.25
    expect(unaligned.uniformScale).toBeCloseTo(0.25, 6);

    // 90° rotation around X — quaternion (sin(π/4), 0, 0, cos(π/4))
    // = (√½, 0, 0, √½). The disc stands on edge: Y now spans 4, Z spans 0.1.
    const s = Math.SQRT1_2;
    const rotated = computePlanetPreviewFit(scene, [s, 0, 0, s]);
    expect(rotated.uniformScale).toBeCloseTo(0.25, 6);
    expect(rotated.translation[0]).toBeCloseTo(0, 6);
    expect(rotated.translation[1]).toBeCloseTo(0, 6);
    expect(rotated.translation[2]).toBeCloseTo(0, 6);
  });
});
