import type { Vec3 } from '../../../scene/types/kinematics';
import type { VelocityReadout } from '../../types/velocity-readout';

const clamp01 = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

export const projectVelocityReadout = (velocity: Vec3, maxSpeed: number): VelocityReadout => {
  const metersPerSecond = Math.hypot(velocity.x, velocity.z);
  const ratio = clamp01(metersPerSecond / maxSpeed);
  return { kind: 'readout', metersPerSecond, ratio };
};
