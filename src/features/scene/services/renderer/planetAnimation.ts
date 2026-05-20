import type { MeshStandardMaterial } from 'three';
import type { PlanetVisualPlan, PulseSpec } from './planetTypes';

const TWO_PI = Math.PI * 2;

// Body emissive floor. Per-asset `pulse.amplitude` rides on top so the
// effective range is [PULSE_FLOOR, PULSE_FLOOR + amplitude] — the planet
// never dims below this even at the trough of the sine, regardless of activation.
const PULSE_FLOOR = 0.5;

// Body pulse (warm emissive breathing) — the baseline "alive" cue. Runs
// every frame regardless of activation; the rim is what gates on proximity.
export const animatePulse = (
  materials: ReadonlyArray<MeshStandardMaterial>,
  pulse: PulseSpec,
  time: number,
  phase: number,
): void => {
  const pulseT = (Math.sin(time * pulse.frequencyHz * TWO_PI + phase) + 1) * 0.5;
  const intensity = PULSE_FLOOR + pulse.amplitude * pulseT;
  for (const m of materials) m.emissiveIntensity = intensity;
};

// Applies per-frame mutations to the visual plan:
// - Body pulse always runs (baseline aliveness).
// - Rim opacity, idle rim breath, and shader time are multiplied by
//   activationFactor (0..1) so the rim fades in/out on proximity.
export const animatePlan = (
  plan: PlanetVisualPlan,
  time: number,
  phase: number,
  activationFactor: number,
): void => {
  if (plan.kind === 'plain') return;

  animatePulse(plan.standardMaterials, plan.pulse, time, phase);

  const { breath, baseOpacity, opacityUniform, timeUniform, rimMesh, baseScale, scalePulse } =
    plan.atmosphere;
  const breathT = (Math.sin(time * breath.frequencyHz * TWO_PI + phase * 0.6) + 1) * 0.5;
  const breathFactor = 1 - breath.amplitude * 0.5 + breath.amplitude * breathT;
  opacityUniform.value = baseOpacity * breathFactor * activationFactor;
  timeUniform.value = time;
  // Rim size pulse — gated by activationFactor so the rim only "breathes
  // outward" when active; at rest it sits at baseScale (invisible via the
  // opacity gating above). Distinct phase offset from the opacity breath so
  // size and brightness don't lock into the same rhythm.
  const scalePulseT =
    (Math.sin(time * scalePulse.frequencyHz * TWO_PI + phase * 1.1) + 1) * 0.5;
  const pulseFactor = 1 + scalePulse.amplitude * scalePulseT * activationFactor;
  rimMesh.scale.setScalar(baseScale * pulseFactor);
};
