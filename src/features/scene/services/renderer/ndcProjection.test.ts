import { describe, expect, it } from 'vitest';
import { clampToEdge, isInsideNdc } from './ndcProjection';

describe('ndcProjection — isInsideNdc + clampToEdge', () => {
  it('isInsideNdc returns true when both coords are within [-1, 1]', () => {
    expect(isInsideNdc([0, 0])).toBe(true);
    expect(isInsideNdc([-1, 1])).toBe(true);
    expect(isInsideNdc([0.5, -0.5])).toBe(true);
  });

  it('isInsideNdc returns false when either coord is outside [-1, 1]', () => {
    expect(isInsideNdc([1.5, 0])).toBe(false);
    expect(isInsideNdc([0, -1.2])).toBe(false);
    expect(isInsideNdc([2, 2])).toBe(false);
  });

  it('clampToEdge scales an off-screen NDC point onto the EDGE_PADDING shell while preserving direction', () => {
    const result = clampToEdge(2, 0);
    expect(result.edgeX).toBeCloseTo(0.92, 5);
    expect(result.edgeY).toBeCloseTo(0, 5);
  });

  it('clampToEdge preserves the angle for diagonal off-screen targets', () => {
    const result = clampToEdge(3, 3);
    // Both coords were equal at input, magnitude=3, scale=0.92/3, so both
    // end up at 0.92.
    expect(result.edgeX).toBeCloseTo(0.92, 5);
    expect(result.edgeY).toBeCloseTo(0.92, 5);
  });

  it('clampToEdge returns origin for a zero-magnitude input (degenerate)', () => {
    expect(clampToEdge(0, 0)).toEqual({ edgeX: 0, edgeY: 0 });
  });
});
