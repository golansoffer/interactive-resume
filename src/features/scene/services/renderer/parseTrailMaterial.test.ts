import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, type Material } from 'three';
import { parseTrailMaterial } from './parseTrailMaterial';

describe('parseTrailMaterial', () => {
  it('returns the mesh material when material is a single Material', () => {
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
    expect(parseTrailMaterial(mesh)).toBe(material);
  });

  it('throws TypeError when material is an array (drei contract violation)', () => {
    const material = new MeshBasicMaterial();
    const mesh = new Mesh<BoxGeometry, Material | Material[]>(
      new BoxGeometry(1, 1, 1),
      [material],
    );
    expect(() => parseTrailMaterial(mesh)).toThrow(TypeError);
  });
});
