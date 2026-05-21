import { describe, expect, it } from 'vitest';
import type { Intent } from '../../types/intent';
import { ACCELERATION, DECELERATION, integrateMotion, type CameraBasis } from './integrateMotion';
import { MAX_SPEED, type Kinematics } from '../../types/kinematics';

const ZERO: Kinematics = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  heading: 0,
};

const intents = (...kinds: ReadonlyArray<Intent['kind']>): ReadonlySet<Intent['kind']> =>
  new Set(kinds);

// Axis-aligned basis: camera facing +Z, right = +X.
const AXIS_BASIS: CameraBasis = {
  forward: { x: 0, y: 0, z: 1 },
  right: { x: 1, y: 0, z: 0 },
};

// 45° rotated around Y. forward is (sin45, 0, cos45); right is (cos45, 0, -sin45).
const ROOT_HALF = Math.SQRT1_2;
const ROTATED_BASIS: CameraBasis = {
  forward: { x: ROOT_HALF, y: 0, z: ROOT_HALF },
  right: { x: ROOT_HALF, y: 0, z: -ROOT_HALF },
};

const magnitude = (v: { readonly x: number; readonly y: number; readonly z: number }): number =>
  Math.hypot(v.x, v.y, v.z);

describe('integrateMotion — empty input', () => {
  it('returns position unchanged and velocity unchanged when intents is empty and velocity is zero', () => {
    const result = integrateMotion(ZERO, intents(), 0.016, AXIS_BASIS, 1);
    expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('advances position along the post-step velocity and decelerates it when intents is empty', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 0, y: 0, z: 10 } };
    const result = integrateMotion(state, intents(), 0.016, AXIS_BASIS, 1);
    const expectedVelocity = 10 - DECELERATION * 0.016;
    expect(result.velocity.z).toBeCloseTo(expectedVelocity, 10);
    expect(result.position.z).toBeCloseTo(expectedVelocity * 0.016, 10);
  });
});

describe('integrateMotion — pure single-intent motion in the camera basis', () => {
  it('accelerates along +forward (axis-aligned: +Z) when only move_forward is held', () => {
    const result = integrateMotion(ZERO, intents('move_forward'), 0.016, AXIS_BASIS, 1);
    expect(result.velocity.z).toBeGreaterThan(0);
    expect(result.velocity.x).toBe(0);
  });

  it('accelerates along -forward (axis-aligned: -Z) when only move_backward is held', () => {
    const result = integrateMotion(ZERO, intents('move_backward'), 0.016, AXIS_BASIS, 1);
    expect(result.velocity.z).toBeLessThan(0);
    expect(result.velocity.x).toBe(0);
  });

  it('accelerates along -right (axis-aligned: -X) when only strafe_left is held', () => {
    const result = integrateMotion(ZERO, intents('strafe_left'), 0.016, AXIS_BASIS, 1);
    expect(result.velocity.x).toBeLessThan(0);
    expect(result.velocity.z).toBe(0);
  });

  it('accelerates along +right (axis-aligned: +X) when only strafe_right is held', () => {
    const result = integrateMotion(ZERO, intents('strafe_right'), 0.016, AXIS_BASIS, 1);
    expect(result.velocity.x).toBeGreaterThan(0);
    expect(result.velocity.z).toBe(0);
  });
});

describe('integrateMotion — diagonal and opposing intents', () => {
  it('moves at 45° along forward+right when move_forward and strafe_right are both held (axis-aligned basis)', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: MAX_SPEED, y: 0, z: MAX_SPEED } };
    // Pre-load velocity in the diagonal direction so we can read magnitude at the cap directly.
    const result = integrateMotion(state, intents('move_forward', 'strafe_right'), 0.016, AXIS_BASIS, 1);
    expect(result.velocity.x).toBeCloseTo(result.velocity.z, 5);
    expect(result.velocity.x).toBeGreaterThan(0);
    expect(result.velocity.z).toBeGreaterThan(0);
  });

  it('caps diagonal velocity magnitude at MAX_SPEED (no sqrt(2) overshoot — normalization protects)', () => {
    // Drive long enough to saturate the snap-accel.
    let state: Kinematics = ZERO;
    const dt = 1 / 60;
    const heldIntents = intents('move_forward', 'strafe_right');
    for (let i = 0; i < 60; i += 1) {
      state = integrateMotion(state, heldIntents, dt, AXIS_BASIS, 1);
    }
    expect(magnitude(state.velocity)).toBeCloseTo(MAX_SPEED, 5);
  });

  it('treats opposing move_forward + move_backward as zero desired direction (decelerates as if no input)', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 0, y: 0, z: 10 } };
    const result = integrateMotion(
      state,
      intents('move_forward', 'move_backward'),
      0.016,
      AXIS_BASIS,
      1,
    );
    // Deceleration step magnitude at this dt:
    const step = DECELERATION * 0.016;
    expect(result.velocity.z).toBeCloseTo(10 - step, 10);
  });

  it('treats opposing strafe_left + strafe_right as zero desired direction (decelerates as if no input)', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 10, y: 0, z: 0 } };
    const result = integrateMotion(
      state,
      intents('strafe_left', 'strafe_right'),
      0.016,
      AXIS_BASIS,
      1,
    );
    const step = DECELERATION * 0.016;
    expect(result.velocity.x).toBeCloseTo(10 - step, 10);
  });
});

describe('integrateMotion — snap acceleration and deceleration', () => {
  it('reaches MAX_SPEED within ~MAX_SPEED/ACCELERATION seconds when accelerating from rest', () => {
    const dt = 1 / 60;
    let state: Kinematics = ZERO;
    const timeToMax = MAX_SPEED / ACCELERATION;
    const frames = Math.ceil(timeToMax / dt) + 1;
    for (let i = 0; i < frames; i += 1) {
      state = integrateMotion(state, intents('move_forward'), dt, AXIS_BASIS, 1);
    }
    expect(magnitude(state.velocity)).toBeCloseTo(MAX_SPEED, 5);
  });

  it('reaches zero velocity within ~MAX_SPEED/DECELERATION seconds when decelerating from MAX_SPEED', () => {
    const dt = 1 / 60;
    let state: Kinematics = {
      ...ZERO,
      velocity: { x: 0, y: 0, z: MAX_SPEED },
    };
    const timeToStop = MAX_SPEED / DECELERATION;
    const frames = Math.ceil(timeToStop / dt) + 1;
    for (let i = 0; i < frames; i += 1) {
      state = integrateMotion(state, intents(), dt, AXIS_BASIS, 1);
    }
    expect(magnitude(state.velocity)).toBeCloseTo(0, 5);
  });

  it('takes a fixed-magnitude step toward target velocity (frame-time-independent: 2 frames at dt = 60 frames at dt/60)', () => {
    const intentSet = intents('move_forward');
    // Coarse dt: one large step.
    const coarse = integrateMotion(ZERO, intentSet, 0.05, AXIS_BASIS, 1);
    // Fine dt: many small steps producing the same total elapsed time.
    let fine: Kinematics = ZERO;
    const steps = 50;
    const dt = 0.05 / steps;
    for (let i = 0; i < steps; i += 1) {
      fine = integrateMotion(fine, intentSet, dt, AXIS_BASIS, 1);
    }
    // Both should not yet have saturated (0.05 < 14/120 ≈ 0.117).
    expect(magnitude(coarse.velocity)).toBeCloseTo(magnitude(fine.velocity), 5);
  });
});

describe('integrateMotion — camera basis rotation', () => {
  it('moves in the rotated frame when move_forward is held with a 45°-rotated basis', () => {
    const result = integrateMotion(ZERO, intents('move_forward'), 0.016, ROTATED_BASIS, 1);
    expect(result.velocity.x).toBeGreaterThan(0);
    expect(result.velocity.z).toBeGreaterThan(0);
    expect(result.velocity.x).toBeCloseTo(result.velocity.z, 10);
  });

  it('produces different velocity directions for the same intent set under two different bases', () => {
    const axisResult = integrateMotion(ZERO, intents('move_forward'), 0.016, AXIS_BASIS, 1);
    const rotatedResult = integrateMotion(ZERO, intents('move_forward'), 0.016, ROTATED_BASIS, 1);
    expect(rotatedResult.velocity.x).not.toBeCloseTo(axisResult.velocity.x, 10);
  });
});

describe('integrateMotion — Y-axis preservation', () => {
  it('does not modify position.y when basis vectors have zero Y components', () => {
    const state: Kinematics = {
      position: { x: 0, y: 3.5, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: 0,
    };
    const result = integrateMotion(state, intents('move_forward'), 0.016, AXIS_BASIS, 1);
    expect(result.position.y).toBe(3.5);
  });

  it('does not modify velocity.y when basis vectors have zero Y components', () => {
    const result = integrateMotion(ZERO, intents('move_forward', 'strafe_right'), 0.016, AXIS_BASIS, 1);
    expect(result.velocity.y).toBe(0);
  });
});

describe('integrateMotion — heading is preserved (no longer consumed by the integrator)', () => {
  it('returns state.heading unchanged regardless of intents', () => {
    const state: Kinematics = { ...ZERO, heading: 1.25 };
    const a = integrateMotion(state, intents(), 0.016, AXIS_BASIS, 1);
    const b = integrateMotion(state, intents('move_forward'), 0.016, AXIS_BASIS, 1);
    const c = integrateMotion(state, intents('strafe_left', 'move_backward'), 0.016, AXIS_BASIS, 1);
    expect(a.heading).toBe(1.25);
    expect(b.heading).toBe(1.25);
    expect(c.heading).toBe(1.25);
  });
});

describe('integrateMotion — purity', () => {
  it('does not mutate the input state, intent set, or basis', () => {
    const state: Kinematics = {
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 4, y: 5, z: 6 },
      heading: 0.5,
    };
    const stateSnapshot = JSON.parse(JSON.stringify(state)) as Kinematics;
    const activeIntents = intents('move_forward', 'strafe_right');
    const intentsSnapshot = new Set(activeIntents);
    const basisSnapshot = JSON.parse(JSON.stringify(AXIS_BASIS)) as CameraBasis;
    integrateMotion(state, activeIntents, 0.016, AXIS_BASIS, 1);
    expect(state).toEqual(stateSnapshot);
    expect(activeIntents).toEqual(intentsSnapshot);
    expect(AXIS_BASIS).toEqual(basisSnapshot);
  });

  it('returns the same output for the same inputs across repeated calls (referentially transparent)', () => {
    const state: Kinematics = {
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 4, y: 0, z: -2 },
      heading: 0.25,
    };
    const activeIntents = intents('move_forward', 'strafe_left');
    const first = integrateMotion(state, activeIntents, 0.016, ROTATED_BASIS, 1);
    const second = integrateMotion(state, activeIntents, 0.016, ROTATED_BASIS, 1);
    expect(first).toEqual(second);
  });
});

describe('integrateMotion — boost multiplier', () => {
  it('with multiplier=1, behavior is identical to the un-boosted baseline (no regression on existing math)', () => {
    const dt = 1 / 60;
    let stateMul1: Kinematics = ZERO;
    let stateMul1Again: Kinematics = ZERO;
    for (let i = 0; i < 30; i += 1) {
      stateMul1 = integrateMotion(stateMul1, intents('move_forward'), dt, AXIS_BASIS, 1);
      stateMul1Again = integrateMotion(stateMul1Again, intents('move_forward'), dt, AXIS_BASIS, 1);
    }
    expect(stateMul1).toEqual(stateMul1Again);
    expect(magnitude(stateMul1.velocity)).toBeCloseTo(MAX_SPEED, 5);
  });

  it('with multiplier=3 and full-forward intent, velocity converges to MAX_SPEED × 3 along forward', () => {
    const dt = 1 / 60;
    let state: Kinematics = ZERO;
    const timeToMax = (MAX_SPEED * 3) / ACCELERATION;
    const frames = Math.ceil(timeToMax / dt) + 2;
    for (let i = 0; i < frames; i += 1) {
      state = integrateMotion(state, intents('move_forward'), dt, AXIS_BASIS, 3);
    }
    expect(magnitude(state.velocity)).toBeCloseTo(MAX_SPEED * 3, 5);
    expect(state.velocity.z).toBeCloseTo(MAX_SPEED * 3, 5);
  });

  it('with multiplier=3 and no intents, decelerates as if no input (multiplier scales target, not deceleration)', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 0, y: 0, z: 10 } };
    const result = integrateMotion(state, intents(), 0.016, AXIS_BASIS, 3);
    const step = DECELERATION * 0.016;
    expect(result.velocity.z).toBeCloseTo(10 - step, 10);
  });
});
