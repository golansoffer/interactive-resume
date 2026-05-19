import { describe, expect, it } from 'vitest';
import {
  HERO_SWAY_AMPLITUDE,
  HERO_SWAY_FREQ_HZ,
  HOVER_SPEED,
  REST_LERP,
  STATIC_ANGLE_Y,
  TWO_PI,
  heroSwayY,
  tickRotation,
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

describe('heroSwayY', () => {
  it('returns STATIC_ANGLE_Y at t=0 (sin(0) = 0)', () => {
    expect(heroSwayY(0)).toBeCloseTo(STATIC_ANGLE_Y, 10);
  });

  it('returns STATIC_ANGLE_Y at one full period', () => {
    const period = 1 / HERO_SWAY_FREQ_HZ;
    expect(heroSwayY(period)).toBeCloseTo(STATIC_ANGLE_Y, 10);
  });

  it('reaches maximum +amplitude at quarter period', () => {
    const quarter = 1 / (HERO_SWAY_FREQ_HZ * 4);
    expect(heroSwayY(quarter)).toBeCloseTo(STATIC_ANGLE_Y + HERO_SWAY_AMPLITUDE, 10);
  });

  it('reaches minimum -amplitude at three-quarter period', () => {
    const threeQuarter = 3 / (HERO_SWAY_FREQ_HZ * 4);
    expect(heroSwayY(threeQuarter)).toBeCloseTo(STATIC_ANGLE_Y - HERO_SWAY_AMPLITUDE, 10);
  });

  it('stays within ±amplitude of STATIC_ANGLE_Y for all sampled times', () => {
    for (let t = 0; t < 60; t += 0.05) {
      const y = heroSwayY(t);
      expect(y).toBeGreaterThanOrEqual(STATIC_ANGLE_Y - HERO_SWAY_AMPLITUDE - 1e-9);
      expect(y).toBeLessThanOrEqual(STATIC_ANGLE_Y + HERO_SWAY_AMPLITUDE + 1e-9);
    }
  });

  it('exposes positive amplitude and frequency', () => {
    expect(HERO_SWAY_AMPLITUDE).toBeGreaterThan(0);
    expect(HERO_SWAY_FREQ_HZ).toBeGreaterThan(0);
  });
});
