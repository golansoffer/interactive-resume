import type { SatelliteOrbit } from '../../types/satellite';

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

export const satelliteOffset = (
  orbit: SatelliteOrbit,
  timeSeconds: number,
): readonly [number, number, number] => {
  const angle = (timeSeconds / orbit.periodSeconds) * TWO_PI + orbit.phase;
  const inclination = orbit.inclinationDeg * DEG_TO_RAD;
  const z = Math.cos(angle) * orbit.radius;
  const planar = Math.sin(angle) * orbit.radius;
  const x = planar * Math.cos(inclination);
  const y = planar * Math.sin(inclination);
  return [x, y, z];
};
