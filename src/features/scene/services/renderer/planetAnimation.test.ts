import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { animatePulse, animatePlan } from './planetAnimation';
import type {
  AtmospherePlan,
  PlanetVisualPlan,
  PulseSpec,
} from './planetTypes';

const makePulse = (overrides: Partial<PulseSpec> = {}): PulseSpec => ({
  amplitude: 0.6,
  frequencyHz: 0.1,
  floor: 0.4,
  emissiveTint: [1, 1, 1],
  ...overrides,
});

const makeMaterial = (): MeshStandardMaterial => {
  const m = new MeshStandardMaterial();
  // Sentinel so we can verify it gets overwritten.
  m.emissiveIntensity = -1;
  return m;
};

const makeAtmospherePlan = (): AtmospherePlan => {
  const opacityUniform = { value: -1 };
  const timeUniform = { value: -1 };
  const rimMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  return {
    opacityUniform,
    timeUniform,
    baseOpacity: 0.8,
    breath: { amplitude: 0.3, frequencyHz: 0.1 },
    rimMesh,
    baseScale: 1.12,
    scalePulse: { amplitude: 0.1, frequencyHz: 0.4 },
  };
};

describe('animatePulse — uses pulse.floor as the trough', () => {
  it('writes pulse.floor + amplitude * 0.5 at time=0 (mid-pulse)', () => {
    const mat = makeMaterial();
    const pulse = makePulse({ floor: 0.3, amplitude: 0.5, frequencyHz: 1 });
    // sin(time * 2π) is 0 at time=0; (sin+1)/2 = 0.5, so intensity = floor + amp*0.5
    animatePulse([mat], pulse, 0, 0);
    expect(mat.emissiveIntensity).toBeCloseTo(0.3 + 0.5 * 0.5, 6);
  });

  it('drives every material in the array', () => {
    const m1 = makeMaterial();
    const m2 = makeMaterial();
    const pulse = makePulse({ floor: 0.5, amplitude: 0.2, frequencyHz: 1 });
    // sin(0.25 * 2π) = sin(π/2) = 1 → t=1 → intensity = floor + amp
    animatePulse([m1, m2], pulse, 0.25, 0);
    expect(m1.emissiveIntensity).toBeCloseTo(0.7, 6);
    expect(m2.emissiveIntensity).toBeCloseTo(0.7, 6);
  });

  it('reads floor from the pulse, not from a module constant', () => {
    const mat = makeMaterial();
    const pulse = makePulse({ floor: 0.05, amplitude: 0, frequencyHz: 1 });
    animatePulse([mat], pulse, 0, 0);
    // amplitude=0 means intensity = floor exactly, regardless of pulseT
    expect(mat.emissiveIntensity).toBeCloseTo(0.05, 6);
  });
});

describe('animatePlan — variant dispatch', () => {
  it('no_body: returns without touching anything', () => {
    const plan: PlanetVisualPlan = { kind: 'no_body', scene: new Object3D() };
    expect(() => animatePlan(plan, 0, 0, 1)).not.toThrow();
  });

  it('body_only: animates pulse on materials, leaves nothing else to touch', () => {
    const mat = makeMaterial();
    const plan: PlanetVisualPlan = {
      kind: 'body_only',
      scene: new Object3D(),
      pulse: makePulse({ floor: 0.3, amplitude: 0, frequencyHz: 1 }),
      standardMaterials: [mat],
    };
    // activationFactor is irrelevant for body_only
    animatePlan(plan, 0, 0, 0);
    expect(mat.emissiveIntensity).toBeCloseTo(0.3, 6);
  });

  it('body_and_rim with activationFactor=0: animates pulse and zeros rim opacity', () => {
    const mat = makeMaterial();
    const atmosphere = makeAtmospherePlan();
    const plan: PlanetVisualPlan = {
      kind: 'body_and_rim',
      scene: new Object3D(),
      pulse: makePulse({ floor: 0.5, amplitude: 0, frequencyHz: 1 }),
      atmosphere,
      standardMaterials: [mat],
    };
    animatePlan(plan, 0, 0, 0);
    expect(mat.emissiveIntensity).toBeCloseTo(0.5, 6);
    expect(atmosphere.opacityUniform.value).toBeCloseTo(0, 6);
  });

  it('body_and_rim with activationFactor=1: opacity scales with breath, time uniform written', () => {
    const mat = makeMaterial();
    const atmosphere = makeAtmospherePlan();
    const plan: PlanetVisualPlan = {
      kind: 'body_and_rim',
      scene: new Object3D(),
      pulse: makePulse(),
      atmosphere,
      standardMaterials: [mat],
    };
    animatePlan(plan, 12.5, 0.3, 1);
    expect(atmosphere.opacityUniform.value).toBeGreaterThan(0);
    expect(atmosphere.timeUniform.value).toBeCloseTo(12.5, 6);
  });
});
