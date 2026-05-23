import type { MeshStandardMaterial } from 'three';
import type { PlanetVisualPlan, PulseSpec } from './planetTypes';

const TWO_PI = Math.PI * 2;

// Body pulse (warm emissive breathing) — the baseline "alive" cue. Runs
// every frame regardless of activation; the rim is what gates on proximity.
export const animatePulse = (
  materials: ReadonlyArray<MeshStandardMaterial>,
  pulse: PulseSpec,
  time: number,
  phase: number,
): void => {
  const pulseT = (Math.sin(time * pulse.frequencyHz * TWO_PI + phase) + 1) * 0.5;
  const intensity = pulse.floor + pulse.amplitude * pulseT;
  for (const m of materials) m.emissiveIntensity = intensity;
};

// Applies per-frame mutations to the visual plan:
// - no_body: nothing animates (degenerate fallback).
// - body_only: body pulse only.
// - body_and_rim: body pulse + rim atmosphere (rim opacity, idle breath,
//   shader time, and scale pulse are multiplied by activationFactor so
//   the rim fades in/out on proximity). The outline is never touched.
export const animatePlan = (
  plan: PlanetVisualPlan,
  time: number,
  phase: number,
  activationFactor: number,
): void => {
  if (plan.kind === 'no_body') return;
  animatePulse(plan.standardMaterials, plan.pulse, time, phase);
  if (plan.kind === 'body_only') return;

  const { breath, baseOpacity, opacityUniform, timeUniform, rimMesh, baseScale, scalePulse } =
    plan.atmosphere;
  const breathT = (Math.sin(time * breath.frequencyHz * TWO_PI + phase * 0.6) + 1) * 0.5;
  const breathFactor = 1 - breath.amplitude * 0.5 + breath.amplitude * breathT;
  opacityUniform.value = baseOpacity * breathFactor * activationFactor;
  timeUniform.value = time;
  const scalePulseT =
    (Math.sin(time * scalePulse.frequencyHz * TWO_PI + phase * 1.1) + 1) * 0.5;
  const pulseFactor = 1 + scalePulse.amplitude * scalePulseT * activationFactor;
  rimMesh.scale.setScalar(baseScale * pulseFactor);
};
