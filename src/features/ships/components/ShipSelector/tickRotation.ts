export const TWO_PI = Math.PI * 2;

// 3/4 view (45°)
export const STATIC_ANGLE_Y = Math.PI * 0.25;
// rad/s; ~4.2s per revolution
export const HOVER_SPEED = 1.5;
// ~300ms ease back
export const REST_LERP = 0.1;

// Hero stage — the featured ship doesn't free-spin like a thumbnail; it
// holds the 3/4 angle and breathes around it. Amplitude in radians, freq
// in Hz. The values produce ~±17° drift over ~6.7 seconds — a slow,
// editorial sway that reads as "alive" without being busy.
export const HERO_SWAY_AMPLITUDE = 0.3;
export const HERO_SWAY_FREQ_HZ = 0.15;

export const tickRotation = (
  currentY: number,
  isHovered: boolean,
  delta: number,
): number => {
  if (isHovered) return currentY + HOVER_SPEED * delta;
  let c = currentY;
  while (c > Math.PI) c -= TWO_PI;
  while (c < -Math.PI) c += TWO_PI;
  let d = STATIC_ANGLE_Y - c;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return c + d * REST_LERP;
};

export const heroSwayY = (elapsedTime: number): number =>
  STATIC_ANGLE_Y + Math.sin(elapsedTime * HERO_SWAY_FREQ_HZ * TWO_PI) * HERO_SWAY_AMPLITUDE;
