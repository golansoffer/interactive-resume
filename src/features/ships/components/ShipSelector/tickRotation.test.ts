import { describe, expect, it } from 'vitest';
import {
  HERO_TRANSITION_MS,
  HOVER_SPEED,
  REST_LERP,
  STATIC_ANGLE_Y,
  TWO_PI,
  easeOutCubic,
  tickRotation,
  transitionScale,
} from './tickRotation';

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

describe('easeOutCubic', () => {
  it('maps 0 → 0 and 1 → 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('is monotonically increasing across the unit interval', () => {
    let prev = easeOutCubic(0);
    for (let t = 0.01; t <= 1; t += 0.01) {
      const v = easeOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('front-loads the curve (eased past the linear midpoint at t=0.5)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('transitionScale', () => {
  it('returns 0 at t = 0 (mesh starts invisible)', () => {
    expect(transitionScale(1, 0)).toBe(0);
  });

  it('returns the target scale at and beyond the transition duration', () => {
    expect(transitionScale(1, HERO_TRANSITION_MS)).toBe(1);
    expect(transitionScale(0.6, HERO_TRANSITION_MS + 5000)).toBe(0.6);
  });

  it('clamps negative elapsed values to 0', () => {
    expect(transitionScale(1, -100)).toBe(0);
  });

  it('scales the target value by the ease curve mid-transition', () => {
    const half = transitionScale(1, HERO_TRANSITION_MS / 2);
    expect(half).toBeGreaterThan(0.5);
    expect(half).toBeLessThan(1);
  });

  it('respects target scale magnitude', () => {
    const small = transitionScale(0.5, HERO_TRANSITION_MS / 2);
    const large = transitionScale(1, HERO_TRANSITION_MS / 2);
    expect(small).toBeCloseTo(large * 0.5, 10);
  });
});
