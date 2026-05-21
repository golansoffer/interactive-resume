import { describe, expect, it } from 'vitest';
import { createSphereColliders } from './sphereColliders';
import type { Sphere } from '../../types/sphere';

const sphereA: Sphere = { center: { x: 1, y: 2, z: 3 }, radius: 4 };
const sphereB: Sphere = { center: { x: 5, y: 6, z: 7 }, radius: 8 };
const sphereAReplacement: Sphere = { center: { x: 9, y: 9, z: 9 }, radius: 1 };

describe('createSphereColliders', () => {
  it('list() returns an empty array before any register call', () => {
    const colliders = createSphereColliders();
    expect(colliders.list()).toEqual([]);
  });

  it('after a single register, list() returns one sphere matching the registered value', () => {
    const colliders = createSphereColliders();
    colliders.register('a', sphereA);
    expect(colliders.list()).toEqual([sphereA]);
  });

  it('re-registering the same id replaces the value rather than appending', () => {
    const colliders = createSphereColliders();
    colliders.register('a', sphereA);
    colliders.register('a', sphereAReplacement);
    expect(colliders.list()).toEqual([sphereAReplacement]);
  });

  it('registering distinct ids accumulates entries — both spheres are present in list()', () => {
    const colliders = createSphereColliders();
    colliders.register('a', sphereA);
    colliders.register('b', sphereB);
    const result = colliders.list();
    expect(result).toHaveLength(2);
    expect(result).toContain(sphereA);
    expect(result).toContain(sphereB);
  });
});
