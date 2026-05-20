export type SunAnimationState = {
  readonly bodyRotationY: number;
  readonly coronaOpacityScale: number;
  readonly haloOpacityScale: number;
};

const TWO_PI = Math.PI * 2;

// Sun rotation — discovery-time, very slow. Below the planets' base rotation
// rate so the sun reads as massive and stately, not spinning.
const SUN_ROTATION_RATE = 0.05;

// Corona and halo pulses share the frequency; halo is phase-offset by π so
// the sun "breathes" — when the inner ring brightens, the outer halo dims,
// and vice versa.
const CORONA_PULSE_HZ = 0.08;
const CORONA_PULSE_AMP = 0.1;
const HALO_PULSE_HZ = 0.08;
const HALO_PULSE_AMP = 0.12;

export const sunAnimationAt = (timeSeconds: number): SunAnimationState => ({
  bodyRotationY: timeSeconds * SUN_ROTATION_RATE,
  coronaOpacityScale:
    1 + Math.sin(timeSeconds * TWO_PI * CORONA_PULSE_HZ) * CORONA_PULSE_AMP,
  haloOpacityScale:
    1 + Math.sin(timeSeconds * TWO_PI * HALO_PULSE_HZ + Math.PI) * HALO_PULSE_AMP,
});
