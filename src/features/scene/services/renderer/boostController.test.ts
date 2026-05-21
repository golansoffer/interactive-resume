import { describe, expect, it } from 'vitest';
import { createBoostController } from './boostController';
import { createBoostSignal } from '../registries/boostSignal';

describe('createBoostController', () => {
  it('returns an inactive step with factor near 0 on the first tick with boostHeld=false', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    const step = controller.tick(false, false, 0.016);
    expect(step.kind).toBe('inactive');
    expect(step.multiplier).toBe(1);
    expect(step.factor).toBeCloseTo(0, 6);
  });

  it('returns an active step with multiplier 3 when boostHeld=true and not in any activation', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    const step = controller.tick(true, false, 0.016);
    expect(step.kind).toBe('active');
    expect(step.multiplier).toBe(3);
    expect(step.factor).toBeGreaterThan(0);
  });

  it('returns an inactive step when boostHeld=true but the player is inside an activation radius', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    const step = controller.tick(true, true, 0.016);
    expect(step.kind).toBe('inactive');
    expect(step.multiplier).toBe(1);
  });

  it('factor ramps toward 1 across repeated active ticks and stays bounded', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    let factor = 0;
    for (let i = 0; i < 60; i += 1) {
      const step = controller.tick(true, false, 0.016);
      factor = step.factor;
    }
    expect(factor).toBeGreaterThan(0.9);
    expect(factor).toBeLessThanOrEqual(1);
  });

  it('factor ramps back toward 0 after the boost is released', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    for (let i = 0; i < 60; i += 1) controller.tick(true, false, 0.016);
    let factor = controller.tick(false, false, 0.016).factor;
    for (let i = 0; i < 60; i += 1) {
      factor = controller.tick(false, false, 0.016).factor;
    }
    expect(factor).toBeLessThan(0.1);
    expect(factor).toBeGreaterThanOrEqual(0);
  });

  it('writes (active, factor) through the BoostSignal on every tick', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    controller.tick(true, false, 0.5);
    const read = signal.read();
    expect(read.active).toBe(true);
    expect(read.factor).toBeGreaterThan(0);
    controller.tick(false, false, 0.5);
    const read2 = signal.read();
    expect(read2.active).toBe(false);
  });
});
