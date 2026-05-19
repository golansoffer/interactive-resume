export const TWO_PI = Math.PI * 2;

// 3/4 view (45°)
export const STATIC_ANGLE_Y = Math.PI * 0.25;
// rad/s; ~4.2s per revolution
export const HOVER_SPEED = 1.5;
// ~300ms ease back
export const REST_LERP = 0.1;

// Hero swap crossfade — outgoing mesh fades 1→0 and incoming mesh fades
// 0→1 over the same window. The text block uses the same duration via
// the matching CSS keyframes (fadeIn / fadeOut).
export const HERO_TRANSITION_MS = 400;

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

export type HeroFadeRole = 'fading_in' | 'fading_out';

// Opacity during a hero swap. Clamped at both ends so the consumer can
// drive useFrame without re-clamping. fading_in: 0 → 1, fading_out: 1 → 0.
// The two roles are exact reflections — fading_in(t) + fading_out(t) === 1.
export const transitionOpacity = (
  role: HeroFadeRole,
  elapsedMs: number,
): number => {
  if (elapsedMs <= 0) return role === 'fading_in' ? 0 : 1;
  if (elapsedMs >= HERO_TRANSITION_MS) return role === 'fading_in' ? 1 : 0;
  const t = easeOutCubic(elapsedMs / HERO_TRANSITION_MS);
  return role === 'fading_in' ? t : 1 - t;
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
