import { describe, expect, it } from 'vitest';
import { clampOutOfSphere, type Sphere } from './clampOutOfSphere';
import type { Vec3 } from '../../types/kinematics';

const SUN: Sphere = { center: { x: 0, y: 0, z: 0 }, radius: 10 };

describe('clampOutOfSphere', () => {
  it('returns the input unchanged when the position lies strictly outside the sphere', () => {
    const result = clampOutOfSphere({ x: 20, y: 0, z: 0 }, SUN);
    expect(result).toEqual({ x: 20, y: 0, z: 0 });
  });

  it('returns the input unchanged when the position lies exactly on the sphere surface', () => {
    const result = clampOutOfSphere({ x: 10, y: 0, z: 0 }, SUN);
    expect(result).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('projects an inside-sphere position outward to the surface along the center-to-position ray', () => {
    const result = clampOutOfSphere({ x: 5, y: 0, z: 0 }, SUN);
    expect(result.x).toBeCloseTo(10, 6);
    expect(result.y).toBeCloseTo(0, 6);
    expect(result.z).toBeCloseTo(0, 6);
  });

  it('preserves the direction from center to position when projecting outward', () => {
    const result = clampOutOfSphere({ x: 3, y: 4, z: 0 }, SUN);
    expect(Math.hypot(result.x, result.y, result.z)).toBeCloseTo(10, 5);
    expect(result.x / result.y).toBeCloseTo(3 / 4, 6);
  });

  it('handles an off-center sphere by projecting onto the shifted surface', () => {
    const shifted: Sphere = { center: { x: 100, y: 0, z: 0 }, radius: 5 };
    const result = clampOutOfSphere({ x: 101, y: 0, z: 0 }, shifted);
    expect(result.x).toBeCloseTo(105, 6);
  });

  it('returns the input unchanged when sphere.radius is 0 (no-op for unmeasured colliders)', () => {
    const empty: Sphere = { center: { x: 0, y: 0, z: 0 }, radius: 0 };
    const result = clampOutOfSphere({ x: 0, y: 0, z: 0 }, empty);
    expect(result).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('returns a position on the +Y surface when the input lies exactly at center (degenerate direction)', () => {
    const result = clampOutOfSphere({ x: 0, y: 0, z: 0 }, SUN);
    expect(result).toEqual({ x: 0, y: 10, z: 0 });
  });

  it('is idempotent — clamping twice gives the same result as clamping once', () => {
    const input: Vec3 = { x: 1, y: 2, z: 3 };
    const once = clampOutOfSphere(input, SUN);
    const twice = clampOutOfSphere(once, SUN);
    expect(twice).toEqual(once);
  });

  it('does not mutate its inputs', () => {
    const position: Vec3 = { x: 1, y: 2, z: 3 };
    const positionSnapshot: Vec3 = { x: 1, y: 2, z: 3 };
    const sphereSnapshot: Sphere = {
      center: { x: SUN.center.x, y: SUN.center.y, z: SUN.center.z },
      radius: SUN.radius,
    };
    clampOutOfSphere(position, SUN);
    expect(position).toEqual(positionSnapshot);
    expect(SUN).toEqual(sphereSnapshot);
  });
});
