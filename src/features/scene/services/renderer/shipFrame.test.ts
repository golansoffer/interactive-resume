import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { applyHeadingLerp, computeIntentHeading } from './shipFrame';
import { MAX_SPEED } from '../../types/kinematics';
import type { CameraBasis } from './integrateMotion';
import type { Intent } from '../../types/intent';

const AXIS_BASIS: CameraBasis = {
  forward: { x: 0, y: 0, z: 1 },
  right: { x: 1, y: 0, z: 0 },
};

const intents = (...kinds: ReadonlyArray<Intent['kind']>): ReadonlySet<Intent['kind']> =>
  new Set(kinds);

const PREVIOUS = 1.25;

describe('computeIntentHeading — backward is pure reverse, never yaws', () => {
  it('returns the previous heading when no intent is held', () => {
    expect(computeIntentHeading(intents(), AXIS_BASIS, PREVIOUS)).toBe(PREVIOUS);
  });

  it('returns the previous heading when only move_backward is held', () => {
    expect(computeIntentHeading(intents('move_backward'), AXIS_BASIS, PREVIOUS)).toBe(PREVIOUS);
  });

  it('returns the previous heading when move_backward is held alongside move_forward', () => {
    expect(
      computeIntentHeading(intents('move_forward', 'move_backward'), AXIS_BASIS, PREVIOUS),
    ).toBe(PREVIOUS);
  });

  it('returns the previous heading when only boost is held (boost is not directional)', () => {
    expect(computeIntentHeading(intents('boost'), AXIS_BASIS, PREVIOUS)).toBe(PREVIOUS);
  });

  it('returns the camera-forward heading when only move_forward is held', () => {
    // basis.forward = (0, _, 1) → atan2(0, 1) = 0
    expect(computeIntentHeading(intents('move_forward'), AXIS_BASIS, PREVIOUS)).toBe(0);
  });

  it('returns the camera-right heading when only strafe_right is held', () => {
    // basis.right = (1, _, 0) → atan2(1, 0) = π/2
    expect(
      computeIntentHeading(intents('strafe_right'), AXIS_BASIS, PREVIOUS),
    ).toBeCloseTo(Math.PI / 2, 10);
  });

  it('returns the camera-left heading when only strafe_left is held', () => {
    // -basis.right = (-1, _, 0) → atan2(-1, 0) = -π/2
    expect(
      computeIntentHeading(intents('strafe_left'), AXIS_BASIS, PREVIOUS),
    ).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('returns the previous heading when strafe_left and strafe_right both held (they cancel)', () => {
    expect(
      computeIntentHeading(intents('strafe_left', 'strafe_right'), AXIS_BASIS, PREVIOUS),
    ).toBe(PREVIOUS);
  });

  it('returns the forward+right diagonal heading when move_forward and strafe_right are both held', () => {
    // x = 0+1 = 1, z = 1+0 = 1 → atan2(1, 1) = π/4
    expect(
      computeIntentHeading(intents('move_forward', 'strafe_right'), AXIS_BASIS, PREVIOUS),
    ).toBeCloseTo(Math.PI / 4, 10);
  });

  it('uses only the strafe direction when move_backward is held with strafe_right', () => {
    // move_backward zeroes the forward contribution; strafe_right gives heading π/2
    expect(
      computeIntentHeading(intents('move_backward', 'strafe_right'), AXIS_BASIS, PREVIOUS),
    ).toBeCloseTo(Math.PI / 2, 10);
  });
});

describe('applyHeadingLerp — lerps mesh.rotation.y toward the target heading', () => {
  it('moves mesh.rotation.y toward the target without overshooting in a single step', () => {
    const mesh = new Object3D();
    mesh.rotation.y = 0;
    applyHeadingLerp(mesh, 1, MAX_SPEED);
    expect(mesh.rotation.y).toBeGreaterThan(0);
    expect(mesh.rotation.y).toBeLessThan(1);
  });

  it('does not change rotation.y when target equals current heading', () => {
    const mesh = new Object3D();
    mesh.rotation.y = 0.42;
    applyHeadingLerp(mesh, 0.42, MAX_SPEED);
    expect(mesh.rotation.y).toBeCloseTo(0.42, 10);
  });

  it('wraps the shortest path across the ±π boundary (lerps from -π+ε toward π-ε via the short side)', () => {
    const mesh = new Object3D();
    mesh.rotation.y = -Math.PI + 0.1;
    applyHeadingLerp(mesh, Math.PI - 0.1, MAX_SPEED);
    // Shortest path is via -π / +π wrap (delta ≈ -0.2), so rotation.y decreases.
    expect(mesh.rotation.y).toBeLessThan(-Math.PI + 0.1);
  });

  it('converges arbitrarily close to the target after enough ticks', () => {
    const mesh = new Object3D();
    mesh.rotation.y = 0;
    for (let i = 0; i < 500; i += 1) {
      applyHeadingLerp(mesh, 1, MAX_SPEED);
    }
    expect(mesh.rotation.y).toBeCloseTo(1, 5);
  });

  it('rotates noticeably slower at rest than at flight speed for the same target', () => {
    const restMesh = new Object3D();
    restMesh.rotation.y = 0;
    applyHeadingLerp(restMesh, 1, 0);

    const speedMesh = new Object3D();
    speedMesh.rotation.y = 0;
    applyHeadingLerp(speedMesh, 1, MAX_SPEED);

    // Both step toward the target, but the stationary step is the slower one.
    expect(restMesh.rotation.y).toBeGreaterThan(0);
    expect(restMesh.rotation.y).toBeLessThan(speedMesh.rotation.y);
  });
});
