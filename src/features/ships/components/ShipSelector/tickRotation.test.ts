import { describe, expect, it } from 'vitest';
import {
  HERO_TRANSITION_MS,
  HOVER_SPEED,
  REST_LERP,
  STATIC_ANGLE_Y,
  TWO_PI,
  easeOutCubic,
  tickRotation,
  transitionOpacity,
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

describe('transitionOpacity', () => {
  it('fading_in starts at 0 when t <= 0', () => {
    expect(transitionOpacity('fading_in', 0)).toBe(0);
    expect(transitionOpacity('fading_in', -100)).toBe(0);
  });

  it('fading_out starts at 1 when t <= 0', () => {
    expect(transitionOpacity('fading_out', 0)).toBe(1);
    expect(transitionOpacity('fading_out', -100)).toBe(1);
  });

  it('fading_in lands at 1 at and beyond the transition duration', () => {
    expect(transitionOpacity('fading_in', HERO_TRANSITION_MS)).toBe(1);
    expect(transitionOpacity('fading_in', HERO_TRANSITION_MS + 5000)).toBe(1);
  });

  it('fading_out lands at 0 at and beyond the transition duration', () => {
    expect(transitionOpacity('fading_out', HERO_TRANSITION_MS)).toBe(0);
    expect(transitionOpacity('fading_out', HERO_TRANSITION_MS + 5000)).toBe(0);
  });

  it('fading_in and fading_out are reflections — their sum is 1 across the interval', () => {
    for (let t = 0; t <= HERO_TRANSITION_MS; t += 25) {
      const sum = transitionOpacity('fading_in', t) + transitionOpacity('fading_out', t);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('fading_in is monotonically non-decreasing', () => {
    let prev = transitionOpacity('fading_in', 0);
    for (let t = 10; t <= HERO_TRANSITION_MS; t += 10) {
      const v = transitionOpacity('fading_in', t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('fading_out is monotonically non-increasing', () => {
    let prev = transitionOpacity('fading_out', 0);
    for (let t = 10; t <= HERO_TRANSITION_MS; t += 10) {
      const v = transitionOpacity('fading_out', t);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });

  it('produces a value strictly inside (0, 1) at the midpoint', () => {
    const mid = transitionOpacity('fading_in', HERO_TRANSITION_MS / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    // ease-out cubic at t=0.5 is past linear midpoint
    expect(mid).toBeGreaterThan(0.5);
  });
});
