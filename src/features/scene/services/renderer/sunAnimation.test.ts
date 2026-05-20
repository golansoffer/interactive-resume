import { describe, expect, it } from 'vitest';
import { sunAnimationAt } from './sunAnimation';

describe('sunAnimationAt', () => {
  it('returns zero body rotation at t=0', () => {
    const state = sunAnimationAt(0);
    expect(state.bodyRotationY).toBe(0);
  });

  it('rotates the body at a constant slow rate over one second', () => {
    const a = sunAnimationAt(0);
    const b = sunAnimationAt(1);
    const rate = b.bodyRotationY - a.bodyRotationY;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(0.2);
  });

  it('returns corona pulse at baseline (1.0) at t=0', () => {
    const state = sunAnimationAt(0);
    expect(state.coronaOpacityScale).toBeCloseTo(1.0, 6);
  });

  it('returns halo pulse at baseline (1.0) at t=0 (counter-phase sine is sin(pi) = 0)', () => {
    const state = sunAnimationAt(0);
    expect(state.haloOpacityScale).toBeCloseTo(1.0, 6);
  });

  it('peaks corona opacity above baseline a quarter-period after t=0', () => {
    // CORONA_PULSE_HZ = 0.08, so quarter period = 1 / (4 * 0.08) = 3.125s
    const state = sunAnimationAt(3.125);
    expect(state.coronaOpacityScale).toBeGreaterThan(1.05);
    expect(state.coronaOpacityScale).toBeLessThan(1.11);
  });

  it('drops halo opacity below baseline a quarter-period after t=0 (counter-phase)', () => {
    // Halo phase-offset by pi from corona ⇒ at corona's peak, halo is at trough
    const state = sunAnimationAt(3.125);
    expect(state.haloOpacityScale).toBeLessThan(0.95);
    expect(state.haloOpacityScale).toBeGreaterThan(0.87);
  });

  it('is pure (same input → same output)', () => {
    expect(sunAnimationAt(5.5)).toEqual(sunAnimationAt(5.5));
  });
});
