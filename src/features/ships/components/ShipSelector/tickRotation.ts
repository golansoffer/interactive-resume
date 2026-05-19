export const TWO_PI = Math.PI * 2;

// 3/4 view (45°)
export const STATIC_ANGLE_Y = Math.PI * 0.25;
// rad/s; ~4.2s per revolution
export const HOVER_SPEED = 1.5;
// ~300ms ease back
export const REST_LERP = 0.1;

// Hero swap animation — when the featured ship changes, the new mesh
// grows from 0 to its target scale with an ease-out curve. Hides the
// abrupt primitive swap behind a soft "fade-in by scale" reveal.
export const HERO_TRANSITION_MS = 280;

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

// Scale during a hero swap. Clamped: t<=0 returns 0, t>=duration returns
// targetScale. The eased curve in between gives a gentle landing.
export const transitionScale = (
  targetScale: number,
  elapsedMs: number,
): number => {
  if (elapsedMs >= HERO_TRANSITION_MS) return targetScale;
  if (elapsedMs <= 0) return 0;
  return targetScale * easeOutCubic(elapsedMs / HERO_TRANSITION_MS);
};

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
