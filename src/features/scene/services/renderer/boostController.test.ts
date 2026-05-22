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

  it('returns an active step with multiplier 4.5 when boost is pressed and no new planet entry', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    const step = controller.tick(true, false, 0.016);
    expect(step.kind).toBe('active');
    expect(step.multiplier).toBe(4.5);
    expect(step.factor).toBeGreaterThan(0);
  });

  it('stays active across many held frames when no new planet entry occurs', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    let last = controller.tick(true, false, 0.016);
    for (let i = 0; i < 60; i += 1) {
      last = controller.tick(true, false, 0.016);
    }
    expect(last.kind).toBe('active');
  });

  it('cancels on the frame a new planet enters proximity while holding boost', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    controller.tick(true, false, 0.016);
    const cancelStep = controller.tick(true, true, 0.016);
    expect(cancelStep.kind).toBe('inactive');
    expect(cancelStep.multiplier).toBe(1);
  });

  it('stays cancelled across subsequent held frames after the entry edge passes', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    controller.tick(true, false, 0.016);
    controller.tick(true, true, 0.016);
    let last = controller.tick(true, false, 0.016);
    for (let i = 0; i < 30; i += 1) {
      last = controller.tick(true, false, 0.016);
    }
    expect(last.kind).toBe('inactive');
  });

  it('re-arms on release-then-press after a cancel — press-edge resets the latch', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    controller.tick(true, false, 0.016);
    controller.tick(true, true, 0.016);
    controller.tick(true, false, 0.016);
    controller.tick(false, false, 0.016);
    const reArmed = controller.tick(true, false, 0.016);
    expect(reArmed.kind).toBe('active');
    expect(reArmed.multiplier).toBe(4.5);
  });

  it('engages on first press even when a new planet entry occurred while not holding', () => {
    const signal = createBoostSignal();
    const controller = createBoostController(signal);
    controller.tick(false, true, 0.016);
    const step = controller.tick(true, false, 0.016);
    expect(step.kind).toBe('active');
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
