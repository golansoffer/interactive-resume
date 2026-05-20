import type { BodyExtraction, PoleAxis } from './planetTypes';

export type PlanetSpinAxis = PoleAxis;

export type PlanetPose = {
  readonly tiltEuler: readonly [number, number, number];
  readonly spinAxis: PlanetSpinAxis;
  readonly swayAxis: PlanetSpinAxis;
};

// Axial tilt applied as the final pose offset after the model pole is rotated
// to world up. Direction of tilt is around local X.
const AXIAL_TILT_RAD = 0;
const QUARTER_TURN = Math.PI / 2;

// Maps the auto-detected model pole axis to the (rx, ry, rz) pose that puts
// the pole pointing along world up. Same mapping for ringed and non-ringed
// bodies: for a ringed body the pole is the ring normal; for a non-ringed
// body it is the asset's own pole axis (texture seam axis).
// - 'y': pole already aligned with world up → only the axial tilt around X.
// - 'z': pole pointing toward viewer → +π/2 around X brings it to world up,
//   axial tilt is layered on top.
// - 'x': pole pointing sideways → +π/2 around Z brings it to world up, axial
//   tilt around X on top.
const tiltEulerFor = (axis: PoleAxis): readonly [number, number, number] => {
  if (axis === 'y') return [AXIAL_TILT_RAD, 0, 0];
  if (axis === 'z') return [QUARTER_TURN - AXIAL_TILT_RAD, 0, 0];
  return [AXIAL_TILT_RAD, 0, QUARTER_TURN];
};

// Planet spins around its own pole — same axis in model space. The tilt above
// reorients that pole to world up; the spin itself must stay on the pole
// axis or the planet tumbles instead of rotating about its pole. Sway is a
// tiny perpendicular nod.
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
  if (extraction.kind === 'no_body') return IDENTITY_POSE;
  return {
    tiltEuler: tiltEulerFor(extraction.poleAxis),
    spinAxis: extraction.poleAxis,
    swayAxis: swayAxisFor(extraction.poleAxis),
  };
};
