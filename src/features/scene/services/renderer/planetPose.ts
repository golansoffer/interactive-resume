import type { BodyExtraction, RingNormalAxis } from './planetTypes';

export type PlanetSpinAxis = 'x' | 'y' | 'z';

export type PlanetPose = {
  readonly tiltEuler: readonly [number, number, number];
  readonly spinAxis: PlanetSpinAxis;
  readonly swayAxis: PlanetSpinAxis;
};

// Axial tilt applied as the final pose offset after the ring plane is rotated
// to horizontal. Direction of tilt is around local X.
const AXIAL_TILT_RAD = 0;
const QUARTER_TURN = Math.PI / 2;

// Maps the auto-detected ring normal axis to the (rx, ry, rz) pose that puts
// the ring plane horizontal.
// - 'y': ring already in local XZ plane → only the axial tilt around X.
// - 'z': ring in local XY (normal toward viewer) → +π/2 around X brings the
//   normal to world up, axial tilt is layered on top.
// - 'x': ring in local YZ (normal sideways) → +π/2 around Z brings the normal
//   to world up, axial tilt around X on top.
const tiltEulerFor = (axis: RingNormalAxis): readonly [number, number, number] => {
  if (axis === 'y') return [AXIAL_TILT_RAD, 0, 0];
  if (axis === 'z') return [QUARTER_TURN - AXIAL_TILT_RAD, 0, 0];
  return [AXIAL_TILT_RAD, 0, QUARTER_TURN];
};

// Planet spins around its own pole — same axis as the ring normal in model
// space. The tilt above reorients that pole to world up; the spin itself
// must stay on the ring-normal axis or the planet tumbles instead of
// rotating about its pole. Sway is a tiny perpendicular nod.
const swayAxisFor = (spin: PlanetSpinAxis): PlanetSpinAxis => {
  if (spin === 'x') return 'z';
  if (spin === 'y') return 'z';
  return 'x';
};

const IDENTITY_POSE: PlanetPose = {
  tiltEuler: [0, 0, 0],
  spinAxis: 'y',
  swayAxis: 'z',
};

export const planetPoseFor = (extraction: BodyExtraction): PlanetPose => {
  if (extraction.kind !== 'ringed_body') return IDENTITY_POSE;
  return {
    tiltEuler: tiltEulerFor(extraction.ringNormalAxis),
    spinAxis: extraction.ringNormalAxis,
    swayAxis: swayAxisFor(extraction.ringNormalAxis),
  };
};
