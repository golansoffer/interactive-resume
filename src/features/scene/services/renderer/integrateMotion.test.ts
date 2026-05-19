import { describe, expect, it } from 'vitest';
import type { Intent } from '../../types/intent';
import { integrateMotion, type Kinematics } from './integrateMotion';

const ZERO: Kinematics = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  heading: 0,
};

const intents = (...kinds: ReadonlyArray<Intent['kind']>): ReadonlySet<Intent['kind']> =>
  new Set(kinds);

describe('integrateMotion', () => {
  it('returns the input position unchanged when the active intent set is empty and velocity is zero', () => {
    const result = integrateMotion(ZERO, intents(), 0.016);
    expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('advances position along the existing velocity when the active intent set is empty and velocity is non-zero', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 0, y: 0, z: 10 } };
    const result = integrateMotion(state, intents(), 0.016);
    expect(result.position.z).toBeGreaterThan(0);
  });

  it('leaves the velocity unchanged when the active intent set is empty (no acceleration without intent)', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 0, y: 0, z: 10 } };
    const result = integrateMotion(state, intents(), 0.016);
    expect(result.velocity).toEqual({ x: 0, y: 0, z: 10 });
  });

  it('increases the velocity component along the heading axis when the active intent set contains thrust_forward', () => {
    const result = integrateMotion(ZERO, intents('thrust_forward'), 0.016);
    expect(result.velocity.z).toBeGreaterThan(0);
  });

  it('decreases the velocity component along the heading axis when the active intent set contains thrust_backward', () => {
    const result = integrateMotion(ZERO, intents('thrust_backward'), 0.016);
    expect(result.velocity.z).toBeLessThan(0);
  });

  it('yields a net-zero velocity change when both thrust_forward and thrust_backward are active in the same frame', () => {
    const result = integrateMotion(ZERO, intents('thrust_forward', 'thrust_backward'), 0.016);
    expect(result.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('reduces the velocity magnitude when the active intent set contains brake and velocity is non-zero', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 0, y: 0, z: 10 } };
    const result = integrateMotion(state, intents('brake'), 0.016);
    const speed = Math.hypot(result.velocity.x, result.velocity.y, result.velocity.z);
    expect(speed).toBeLessThan(10);
  });

  it('preserves the velocity direction (no sign flip) on a single brake frame applied to a non-zero velocity', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 0, y: 0, z: 10 } };
    const result = integrateMotion(state, intents('brake'), 0.016);
    expect(result.velocity.z).toBeGreaterThanOrEqual(0);
  });

  it('leaves a zero velocity unchanged when the active intent set contains brake (brake-from-rest is a no-op)', () => {
    const result = integrateMotion(ZERO, intents('brake'), 0.016);
    expect(result.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('rotates the heading counter-clockwise around the up axis when the active intent set contains turn_left', () => {
    const result = integrateMotion(ZERO, intents('turn_left'), 0.016);
    expect(result.heading).toBeGreaterThan(0);
  });

  it('rotates the heading clockwise around the up axis when the active intent set contains turn_right', () => {
    const result = integrateMotion(ZERO, intents('turn_right'), 0.016);
    expect(result.heading).toBeLessThan(0);
  });

  it('yields a net-zero heading change when both turn_left and turn_right are active in the same frame', () => {
    const result = integrateMotion(ZERO, intents('turn_left', 'turn_right'), 0.016);
    expect(result.heading).toBe(0);
  });

  it('applies both translational and rotational change in the same frame when thrust and turn are both active', () => {
    const result = integrateMotion(ZERO, intents('thrust_forward', 'turn_left'), 0.016);
    expect(result.velocity.z).toBeGreaterThan(0);
    expect(result.heading).toBeGreaterThan(0);
  });

  it('scales the position delta proportionally to dt (motion is continuous, not teleport)', () => {
    const state: Kinematics = { ...ZERO, velocity: { x: 0, y: 0, z: 5 } };
    const small = integrateMotion(state, intents(), 0.016);
    const large = integrateMotion(state, intents(), 0.032);
    expect(large.position.z).toBeCloseTo(small.position.z * 2, 5);
  });

  it('scales the rotation magnitude proportionally to dt', () => {
    const small = integrateMotion(ZERO, intents('turn_left'), 0.016);
    const large = integrateMotion(ZERO, intents('turn_left'), 0.032);
    expect(large.heading).toBeCloseTo(small.heading * 2, 10);
  });

  it('returns deeply unchanged input objects (no mutation of position, velocity, heading, or the active-intents set)', () => {
    const state: Kinematics = {
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 4, y: 5, z: 6 },
      heading: 0.5,
    };
    const stateSnapshot = JSON.parse(JSON.stringify(state)) as Kinematics;
    const activeIntents = intents('thrust_forward', 'turn_left');
    const intentsSnapshot = new Set(activeIntents);
    integrateMotion(state, activeIntents, 0.016);
    expect(state).toEqual(stateSnapshot);
    expect(activeIntents).toEqual(intentsSnapshot);
  });

  it('returns the same output for the same inputs across repeated calls (referentially transparent)', () => {
    const state: Kinematics = {
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 4, y: 0, z: -2 },
      heading: 0.25,
    };
    const activeIntents = intents('thrust_forward', 'turn_right');
    const first = integrateMotion(state, activeIntents, 0.016);
    const second = integrateMotion(state, activeIntents, 0.016);
    expect(first).toEqual(second);
  });
});
