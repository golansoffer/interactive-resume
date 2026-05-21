import { describe, expect, it } from 'vitest';
import { Object3D, Group } from 'three';
import { createOrientationController } from './orientationController';
import type { CameraBasis } from './integrateMotion';
import type { Kinematics } from '../../types/kinematics';

const AXIS_BASIS: CameraBasis = {
  forward: { x: 0, y: 0, z: 1 },
  right: { x: 1, y: 0, z: 0 },
};

const restingKinematics = (): Kinematics => ({
  position: { x: 1, y: 2, z: 3 },
  velocity: { x: 0, y: 0, z: 0 },
  heading: 0,
});

// Velocity z = 14 is MAX_SPEED forward.
const movingKinematics = (): Kinematics => ({
  position: { x: 1, y: 2, z: 3 },
  velocity: { x: 0, y: 0, z: 14 },
  heading: 0,
});

describe('createOrientationController', () => {
  it('writes the mesh position to the kinematics position on every tick', () => {
    const controller = createOrientationController();
    const mesh = new Object3D();
    controller.tick(mesh, null, restingKinematics(), AXIS_BASIS, 0);
    expect(mesh.position.x).toBeCloseTo(1, 6);
    expect(mesh.position.y).toBeCloseTo(2, 6);
    expect(mesh.position.z).toBeCloseTo(3, 6);
  });

  it('drives mesh.rotation.x (pitch) toward a nose-down value when moving forward at top speed', () => {
    const controller = createOrientationController();
    const mesh = new Object3D();
    for (let i = 0; i < 200; i += 1) {
      controller.tick(mesh, null, movingKinematics(), AXIS_BASIS, 0);
    }
    // Pitch should be nose-down (negative) and stabilize toward MAX_PITCH.
    expect(mesh.rotation.x).toBeLessThan(0);
  });

  it('writes the idle bob to the visual sub-group y-position when one is provided', () => {
    const controller = createOrientationController();
    const mesh = new Object3D();
    const visual = new Group();
    controller.tick(mesh, visual, restingKinematics(), AXIS_BASIS, 1.0);
    // Bob is nonzero at non-trivial time when at rest.
    expect(Math.abs(visual.position.y)).toBeGreaterThan(0);
  });

  it('leaves the outer mesh y untouched (bob lives on the visual sub-group only)', () => {
    const controller = createOrientationController();
    const mesh = new Object3D();
    controller.tick(mesh, null, restingKinematics(), AXIS_BASIS, 1.0);
    expect(mesh.position.y).toBeCloseTo(2, 6);
  });
});
