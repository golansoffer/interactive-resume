import { describe, expect, it } from 'vitest';
import { MAX_SPEED } from '../../../scene/types/kinematics';
import { projectVelocityReadout } from './projectVelocityReadout';

const v = (x: number, y: number, z: number) => ({ x, y, z });

describe('projectVelocityReadout', () => {
  it('returns kind "readout" with metersPerSecond 0 and ratio 0 when velocity magnitude is 0', () => {
    const result = projectVelocityReadout(v(0, 0, 0), MAX_SPEED);
    expect(result).toEqual({ kind: 'readout', metersPerSecond: 0, ratio: 0 });
  });

  it('returns metersPerSecond equal to max and ratio 1 at top speed', () => {
    const result = projectVelocityReadout(v(MAX_SPEED, 0, 0), MAX_SPEED);
    expect(result.kind).toBe('readout');
    expect(result.metersPerSecond).toBeCloseTo(MAX_SPEED, 10);
    expect(result.ratio).toBeCloseTo(1, 10);
  });

  it('returns ratio 0.5 when velocity magnitude is half of max speed', () => {
    const half = MAX_SPEED / 2;
    const result = projectVelocityReadout(v(half, 0, 0), MAX_SPEED);
    expect(result.metersPerSecond).toBeCloseTo(half, 10);
    expect(result.ratio).toBeCloseTo(0.5, 10);
  });

  it('clamps ratio to 1 when velocity magnitude exceeds max speed', () => {
    const result = projectVelocityReadout(v(MAX_SPEED * 2, 0, 0), MAX_SPEED);
    expect(result.ratio).toBe(1);
  });

  it('returns metersPerSecond equal to the input xz magnitude, not its components', () => {
    // 3-4-5 triangle on the xz plane.
    const result = projectVelocityReadout(v(3, 0, 4), MAX_SPEED);
    expect(result.metersPerSecond).toBeCloseTo(5, 10);
  });

  it('derives ratio independently of vector direction in the xz plane (same magnitude → same readout)', () => {
    const a = projectVelocityReadout(v(0, 0, MAX_SPEED / 2), MAX_SPEED);
    const b = projectVelocityReadout(v(MAX_SPEED / 2, 0, 0), MAX_SPEED);
    expect(a.metersPerSecond).toBeCloseTo(b.metersPerSecond, 10);
    expect(a.ratio).toBeCloseTo(b.ratio, 10);
  });

  it('ignores the y component (matches the player visual lean which is xz-only)', () => {
    const planar = projectVelocityReadout(v(3, 0, 4), MAX_SPEED);
    const withY = projectVelocityReadout(v(3, 99, 4), MAX_SPEED);
    expect(planar.metersPerSecond).toBeCloseTo(withY.metersPerSecond, 10);
    expect(planar.ratio).toBeCloseTo(withY.ratio, 10);
  });
});
