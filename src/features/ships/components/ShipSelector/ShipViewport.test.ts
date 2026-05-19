import { describe, expect, it } from 'vitest';
import {
  HOVER_SPEED,
  REST_LERP,
  STATIC_ANGLE_Y,
  tickRotation,
} from './ShipViewport';

const TWO_PI = Math.PI * 2;

describe('tickRotation', () => {
  it('spins forward at HOVER_SPEED while hovered', () => {
    const next = tickRotation(0, true, 1);
    expect(next).toBeCloseTo(HOVER_SPEED, 10);
  });

  it('integrates delta while hovered', () => {
    const next = tickRotation(0, true, 0.5);
    expect(next).toBeCloseTo(HOVER_SPEED * 0.5, 10);
  });

  it('eases toward STATIC_ANGLE_Y when not hovered', () => {
    const start = 0;
    const next = tickRotation(start, false, 0);
    const expected = start + (STATIC_ANGLE_Y - start) * REST_LERP;
    expect(next).toBeCloseTo(expected, 10);
  });

  it('takes the short path back through the +pi seam', () => {
    // current is just past pi; static angle is small positive; the lerp
    // should pull *negatively* (toward 0 via -pi side), not +2pi the other way.
    const current = Math.PI + 0.1;
    const next = tickRotation(current, false, 0);
    expect(next).toBeLessThan(current);
  });

  it('takes the short path back through the -pi seam', () => {
    const current = -Math.PI - 0.1;
    const next = tickRotation(current, false, 0);
    expect(next).toBeGreaterThan(current);
  });

  it('produces a fixed point at STATIC_ANGLE_Y when not hovered', () => {
    const next = tickRotation(STATIC_ANGLE_Y, false, 0);
    expect(next).toBeCloseTo(STATIC_ANGLE_Y, 10);
  });

  it('exposes positive HOVER_SPEED, positive REST_LERP, STATIC_ANGLE_Y in [0, 2pi)', () => {
    expect(HOVER_SPEED).toBeGreaterThan(0);
    expect(REST_LERP).toBeGreaterThan(0);
    expect(REST_LERP).toBeLessThanOrEqual(1);
    expect(STATIC_ANGLE_Y).toBeGreaterThanOrEqual(0);
    expect(STATIC_ANGLE_Y).toBeLessThan(TWO_PI);
  });
});
