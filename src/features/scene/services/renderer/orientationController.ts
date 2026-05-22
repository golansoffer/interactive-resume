import type { Group, Object3D } from 'three';
import type { Kinematics } from '../../types/kinematics';
import type { CameraBasis } from './integrateMotion';
import {
  BOOST_TOP_SPEED,
  ORIENT_LERP,
  applyHeadingLerp,
  computeIdleMotion,
  computeRotationTargets,
} from './shipFrame';

// Stateful orientation controller. Owns the smoothed pitch/roll baselines
// (private state) and applies them — plus heading lerp and idle bob/sway —
// directly to the ship meshes each tick. The five positional inputs are
// distinct domain values: the rotated/positioned outer mesh, the visual
// sub-group (bob lives here so it doesn't pollute the trail anchor), the
// integrated kinematics, the camera basis for pitch/roll targets, and the
// clock time for idle oscillation.
export type OrientationController = {
  readonly tick: (
    mesh: Object3D,
    visual: Group | null,
    kinematics: Kinematics,
    basis: CameraBasis,
    elapsedTime: number,
  ) => void;
};

export const createOrientationController = (): OrientationController => {
  let baselinePitch = 0;
  let baselineRoll = 0;
  return {
    tick: (mesh, visual, kinematics, basis, elapsedTime) => {
      const speed = Math.hypot(kinematics.velocity.x, kinematics.velocity.z);
      const speedRatio = speed === 0 ? 0 : Math.min(1, speed / BOOST_TOP_SPEED);
      const idle = computeIdleMotion(speedRatio, elapsedTime);

      mesh.position.set(kinematics.position.x, kinematics.position.y, kinematics.position.z);
      if (visual !== null) visual.position.y = idle.bobY;

      // kinematics.heading is the canonical "where the ship should face" signal,
      // maintained per-frame in Player.tsx from the active intent set (forward
      // + strafe only — backward never yaws). Speed is forwarded so the lerp
      // softens at rest — full-speed flight keeps the original snap, but a
      // pure A/D tap with no forward input rotates gradually instead of
      // pivoting 90° in a handful of frames.
      applyHeadingLerp(mesh, kinematics.heading, speed);

      const target = computeRotationTargets(kinematics.velocity, basis);
      baselinePitch += (target.pitch - baselinePitch) * ORIENT_LERP;
      baselineRoll += (target.roll - baselineRoll) * ORIENT_LERP;
      mesh.rotation.x = baselinePitch;
      mesh.rotation.z = baselineRoll + idle.swayZ;
    },
  };
};
