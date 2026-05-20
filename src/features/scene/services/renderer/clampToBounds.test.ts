import { describe, expect, it } from 'vitest';
import { clampToBounds, type Bounds } from './clampToBounds';
import type { Vec3 } from '../../types/kinematics';

const BOX: Bounds = {
  min: { x: -10, y: -10, z: -10 },
  max: { x: 10, y: 10, z: 10 },
};

describe('clampToBounds', () => {
  it('returns a position deeply equal to the input when the input lies strictly inside bounds', () => {
    const input: Vec3 = { x: 1, y: 2, z: 3 };
    const result = clampToBounds(input, BOX);
    expect(result).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('returns a position at the max.x face when the input x exceeds max.x', () => {
    const result = clampToBounds({ x: 50, y: 0, z: 0 }, BOX);
    expect(result).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('returns a position at the min.x face when the input x is below min.x', () => {
    const result = clampToBounds({ x: -50, y: 0, z: 0 }, BOX);
    expect(result).toEqual({ x: -10, y: 0, z: 0 });
  });

  it('returns a position at the max.y face when the input y exceeds max.y', () => {
    const result = clampToBounds({ x: 0, y: 50, z: 0 }, BOX);
    expect(result).toEqual({ x: 0, y: 10, z: 0 });
  });

  it('returns a position at the min.y face when the input y is below min.y', () => {
    const result = clampToBounds({ x: 0, y: -50, z: 0 }, BOX);
    expect(result).toEqual({ x: 0, y: -10, z: 0 });
  });

  it('returns a position at the max.z face when the input z exceeds max.z', () => {
    const result = clampToBounds({ x: 0, y: 0, z: 50 }, BOX);
    expect(result).toEqual({ x: 0, y: 0, z: 10 });
  });

  it('returns a position at the min.z face when the input z is below min.z', () => {
    const result = clampToBounds({ x: 0, y: 0, z: -50 }, BOX);
    expect(result).toEqual({ x: 0, y: 0, z: -10 });
  });

  it('clamps each axis independently when the input violates multiple axes', () => {
    const result = clampToBounds({ x: 50, y: -50, z: 5 }, BOX);
    expect(result).toEqual({ x: 10, y: -10, z: 5 });
  });

  it('returns the input unchanged when it lies exactly on a face (inclusive boundary)', () => {
    const result = clampToBounds({ x: 10, y: 0, z: 0 }, BOX);
    expect(result).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('returns deeply unchanged input objects (no mutation of position or bounds)', () => {
    const position: Vec3 = { x: 50, y: -50, z: 5 };
    const positionSnapshot: Vec3 = { x: position.x, y: position.y, z: position.z };
    const boundsSnapshot: Bounds = {
      min: { x: BOX.min.x, y: BOX.min.y, z: BOX.min.z },
      max: { x: BOX.max.x, y: BOX.max.y, z: BOX.max.z },
    };
    clampToBounds(position, BOX);
    expect(position).toEqual(positionSnapshot);
    expect(BOX).toEqual(boundsSnapshot);
  });
});
