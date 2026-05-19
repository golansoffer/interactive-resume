export const TWO_PI = Math.PI * 2;

// 3/4 view (45°)
export const STATIC_ANGLE_Y = Math.PI * 0.25;
// rad/s; ~4.2s per revolution
export const HOVER_SPEED = 1.5;
// ~300ms ease back
export const REST_LERP = 0.1;

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
