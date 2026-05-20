import { describe, expect, it } from 'vitest';
import { Mesh, Quaternion, Vector3 } from 'three';
import type { BodyExtraction, PoleDirection } from './planetTypes';
import { planetPoseFor } from './planetPose';

const bodyExtraction = (poleDirection: PoleDirection): BodyExtraction => ({
  kind: 'body',
  mesh: new Mesh(),
  radius: 1,
  poleDirection,
});

const ringedExtraction = (poleDirection: PoleDirection): BodyExtraction => ({
  kind: 'ringed_body',
  mesh: new Mesh(),
  radius: 1,
  poleDirection,
});

// Applies the pose's alignment quaternion to a model-space direction and
// returns where it lands in world space.
const applyAlign = (
  alignQuaternion: readonly [number, number, number, number],
  modelVec: Vector3,
): Vector3 => {
  const [x, y, z, w] = alignQuaternion;
  return modelVec.clone().applyQuaternion(new Quaternion(x, y, z, w));
};

describe('planetPoseFor', () => {
  it('returns the identity quaternion for no_body', () => {
    const pose = planetPoseFor({ kind: 'no_body' });
    expect(pose.alignQuaternion).toEqual([0, 0, 0, 1]);
  });

  it('returns the identity quaternion when the pole already points along +y', () => {
    const pose = planetPoseFor(bodyExtraction([0, 1, 0]));
    expect(pose.alignQuaternion[0]).toBeCloseTo(0, 6);
    expect(pose.alignQuaternion[1]).toBeCloseTo(0, 6);
    expect(pose.alignQuaternion[2]).toBeCloseTo(0, 6);
    expect(pose.alignQuaternion[3]).toBeCloseTo(1, 6);
  });

  it('rotates a +x model pole onto +y world', () => {
    const pose = planetPoseFor(bodyExtraction([1, 0, 0]));
    const landed = applyAlign(pose.alignQuaternion, new Vector3(1, 0, 0));
    expect(landed.x).toBeCloseTo(0, 6);
    expect(landed.y).toBeCloseTo(1, 6);
    expect(landed.z).toBeCloseTo(0, 6);
  });

  it('rotates a +z model pole onto +y world', () => {
    const pose = planetPoseFor(bodyExtraction([0, 0, 1]));
    const landed = applyAlign(pose.alignQuaternion, new Vector3(0, 0, 1));
    expect(landed.x).toBeCloseTo(0, 6);
    expect(landed.y).toBeCloseTo(1, 6);
    expect(landed.z).toBeCloseTo(0, 6);
  });

  it('rotates a diagonal model pole onto +y exactly (cardinal snap would leave residual lean)', () => {
    // Jupiter_b's measured band normal — 0.34 right, 0.77 up, 0.54 forward,
    // normalised. Cardinal-axis snap would land this 24° off vertical; full
    // quaternion alignment carries it onto (0, 1, 0) exactly.
    const direction: PoleDirection = [0.339, 0.770, 0.541];
    const [dx, dy, dz] = direction;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const unit = new Vector3(dx / len, dy / len, dz / len);
    const pose = planetPoseFor(bodyExtraction(direction));
    const landed = applyAlign(pose.alignQuaternion, unit);
    expect(landed.x).toBeCloseTo(0, 5);
    expect(landed.y).toBeCloseTo(1, 5);
    expect(landed.z).toBeCloseTo(0, 5);
  });

  it('handles an anti-parallel pole (model pole at -y) by rotating 180°', () => {
    const pose = planetPoseFor(bodyExtraction([0, -1, 0]));
    const landed = applyAlign(pose.alignQuaternion, new Vector3(0, -1, 0));
    expect(landed.x).toBeCloseTo(0, 6);
    expect(landed.y).toBeCloseTo(1, 6);
    expect(landed.z).toBeCloseTo(0, 6);
  });

  it('normalises non-unit pole directions before computing alignment', () => {
    // (0, 5, 0) should align the same as (0, 1, 0).
    const pose = planetPoseFor(bodyExtraction([0, 5, 0]));
    expect(pose.alignQuaternion[0]).toBeCloseTo(0, 6);
    expect(pose.alignQuaternion[1]).toBeCloseTo(0, 6);
    expect(pose.alignQuaternion[2]).toBeCloseTo(0, 6);
    expect(pose.alignQuaternion[3]).toBeCloseTo(1, 6);
  });

  it('produces identical poses for body and ringed_body with the same poleDirection', () => {
    const directions: ReadonlyArray<PoleDirection> = [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 1],
      [0.339, 0.770, 0.541],
    ];
    for (const d of directions) {
      const bodyPose = planetPoseFor(bodyExtraction(d));
      const ringedPose = planetPoseFor(ringedExtraction(d));
      expect(bodyPose).toEqual(ringedPose);
    }
  });
});
