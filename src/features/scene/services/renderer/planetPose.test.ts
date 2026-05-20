import { describe, expect, it } from 'vitest';
import { Euler, Mesh, Vector3 } from 'three';
import type { BodyExtraction, PoleAxis } from './planetTypes';
import { planetPoseFor } from './planetPose';

const bodyExtraction = (poleAxis: PoleAxis): BodyExtraction => ({
  kind: 'body',
  mesh: new Mesh(),
  radius: 1,
  poleAxis,
});

const ringedExtraction = (poleAxis: PoleAxis): BodyExtraction => ({
  kind: 'ringed_body',
  mesh: new Mesh(),
  radius: 1,
  poleAxis,
});

const modelAxisVector = (axis: PoleAxis): Vector3 => {
  if (axis === 'x') return new Vector3(1, 0, 0);
  if (axis === 'y') return new Vector3(0, 1, 0);
  return new Vector3(0, 0, 1);
};

// Applies the pose's tiltEuler (in XYZ order, matching Three.js group
// rotation default) to a model-space vector and returns where it lands in
// world space.
const applyTilt = (
  tiltEuler: readonly [number, number, number],
  modelVec: Vector3,
): Vector3 => {
  const [rx, ry, rz] = tiltEuler;
  const euler = new Euler(rx, ry, rz, 'XYZ');
  return modelVec.clone().applyEuler(euler);
};

describe('planetPoseFor', () => {
  it('returns identity pose for no_body', () => {
    const pose = planetPoseFor({ kind: 'no_body' });
    expect(pose.tiltEuler).toEqual([0, 0, 0]);
    expect(pose.spinAxis).toBe('y');
    expect(pose.swayAxis).toBe('z');
  });

  it('returns identity pose for body with poleAxis y', () => {
    const pose = planetPoseFor(bodyExtraction('y'));
    expect(pose.tiltEuler).toEqual([0, 0, 0]);
    expect(pose.spinAxis).toBe('y');
    expect(pose.swayAxis).toBe('z');
  });

  it('rotates pole to vertical for body with poleAxis x', () => {
    const pose = planetPoseFor(bodyExtraction('x'));
    expect(pose.spinAxis).toBe('x');
    expect(pose.swayAxis).not.toBe(pose.spinAxis);
    const landed = applyTilt(pose.tiltEuler, modelAxisVector('x'));
    expect(landed.x).toBeCloseTo(0);
    expect(landed.y).toBeCloseTo(1);
    expect(landed.z).toBeCloseTo(0);
  });

  it('rotates pole to vertical for body with poleAxis z', () => {
    const pose = planetPoseFor(bodyExtraction('z'));
    expect(pose.spinAxis).toBe('z');
    expect(pose.swayAxis).not.toBe(pose.spinAxis);
    const landed = applyTilt(pose.tiltEuler, modelAxisVector('z'));
    // The X-rotation tilt for poleAxis 'z' carries +Z to -Y; visually the
    // pole is still vertical (just inverted), which is what matters for
    // planet rendering — a sphere's axis is direction-symmetric on screen.
    expect(landed.x).toBeCloseTo(0);
    expect(Math.abs(landed.y)).toBeCloseTo(1);
    expect(landed.z).toBeCloseTo(0);
  });

  it('produces identical poses for body and ringed_body with the same poleAxis', () => {
    const axes: ReadonlyArray<PoleAxis> = ['x', 'y', 'z'];
    for (const axis of axes) {
      const bodyPose = planetPoseFor(bodyExtraction(axis));
      const ringedPose = planetPoseFor(ringedExtraction(axis));
      expect(bodyPose).toEqual(ringedPose);
    }
  });
});
