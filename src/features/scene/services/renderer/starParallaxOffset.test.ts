import { describe, expect, it } from 'vitest';
import { starParallaxOffset } from './starParallaxOffset';

describe('starParallaxOffset', () => {
  it('returns the zero vector when factor is 0 regardless of camera position', () => {
    const result = starParallaxOffset({ x: 10, y: -5, z: 3 }, 0);
    expect(result.x).toBeCloseTo(0, 12);
    expect(result.y).toBeCloseTo(0, 12);
    expect(result.z).toBeCloseTo(0, 12);
  });

  it('returns -camera × factor componentwise', () => {
    const result = starParallaxOffset({ x: 10, y: -5, z: 3 }, 0.1);
    expect(result.x).toBeCloseTo(-1, 12);
    expect(result.y).toBeCloseTo(0.5, 12);
    expect(result.z).toBeCloseTo(-0.3, 12);
  });

  it('returns the zero vector when camera is at origin', () => {
    const result = starParallaxOffset({ x: 0, y: 0, z: 0 }, 0.5);
    expect(result.x).toBeCloseTo(0, 12);
    expect(result.y).toBeCloseTo(0, 12);
    expect(result.z).toBeCloseTo(0, 12);
  });

  it('returns a fresh object each call (no mutation aliasing)', () => {
    const a = starParallaxOffset({ x: 1, y: 1, z: 1 }, 0.1);
    const b = starParallaxOffset({ x: 1, y: 1, z: 1 }, 0.1);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
