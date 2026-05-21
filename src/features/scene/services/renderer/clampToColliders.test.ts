import { describe, expect, it } from 'vitest';
import { clampToColliders } from './clampToColliders';
import type { Sphere } from '../../types/sphere';

const A: Sphere = { center: { x: 0, y: 0, z: 0 }, radius: 5 };
const B: Sphere = { center: { x: 20, y: 0, z: 0 }, radius: 3 };

describe('clampToColliders', () => {
  it('returns the input position unchanged when the collider list is empty', () => {
    const result = clampToColliders({ x: 1, y: 2, z: 3 }, []);
    expect(result).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('returns the input unchanged when the position is outside every collider', () => {
    const result = clampToColliders({ x: 50, y: 50, z: 50 }, [A, B]);
    expect(result).toEqual({ x: 50, y: 50, z: 50 });
  });

  it('projects out of a single collider when the position is inside it', () => {
    const result = clampToColliders({ x: 1, y: 0, z: 0 }, [A]);
    expect(Math.hypot(result.x, result.y, result.z)).toBeCloseTo(5, 6);
  });

  it('applies clamps from each collider in order — final position respects the last fold step', () => {
    // Place position inside A; after the A clamp it lands on the +X surface
    // of A (radius 5). That surface point is still outside B, so the B
    // clamp is a no-op.
    const result = clampToColliders({ x: 1, y: 0, z: 0 }, [A, B]);
    expect(result).toEqual({ x: 5, y: 0, z: 0 });
  });
});
