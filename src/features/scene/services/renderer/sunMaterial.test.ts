import { describe, expect, it } from 'vitest';
import { AdditiveBlending, ShaderMaterial, Vector3 } from 'three';
import { createSunCoronaMaterial, createSunHaloMaterial } from './sunMaterial';

const readVec3 = (material: ShaderMaterial, name: string): Vector3 => {
  const u = material.uniforms[name];
  if (u === undefined) throw new Error(`${name} uniform missing`);
  const value: unknown = u.value;
  if (!(value instanceof Vector3)) throw new Error(`${name}.value is not a Vector3`);
  return value;
};

const readNumber = (material: ShaderMaterial, name: string): number => {
  const u = material.uniforms[name];
  if (u === undefined) throw new Error(`${name} uniform missing`);
  const value = u.value;
  if (typeof value !== 'number') throw new Error(`${name}.value is not a number`);
  return value;
};

describe('createSunCoronaMaterial', () => {
  it('returns a ShaderMaterial instance', () => {
    expect(createSunCoronaMaterial()).toBeInstanceOf(ShaderMaterial);
  });

  it('uses additive blending with depthWrite off and tone mapping off', () => {
    const m = createSunCoronaMaterial();
    expect(m.blending).toBe(AdditiveBlending);
    expect(m.depthWrite).toBe(false);
    expect(m.transparent).toBe(true);
    expect(m.toneMapped).toBe(false);
  });

  it('exposes a warm-yellow core color uniform', () => {
    const core = readVec3(createSunCoronaMaterial(), 'uColorCore');
    expect(core.x).toBeGreaterThan(0.9);
    expect(core.y).toBeGreaterThan(0.8);
    expect(core.z).toBeGreaterThan(0.5);
    expect(core.z).toBeLessThan(core.x);
  });

  it('exposes a warm-amber rim color uniform', () => {
    const rim = readVec3(createSunCoronaMaterial(), 'uColorRim');
    expect(rim.x).toBeGreaterThan(0.9);
    expect(rim.y).toBeGreaterThan(rim.z);
  });

  it('exposes uOpacityScale initialised to 1', () => {
    expect(readNumber(createSunCoronaMaterial(), 'uOpacityScale')).toBe(1);
  });

  it('exposes uFalloff (corona has a sharpish edge — exponent > 1)', () => {
    expect(readNumber(createSunCoronaMaterial(), 'uFalloff')).toBeGreaterThan(1);
  });

  it('exposes uPeakOpacity equal to 1 (corona is bright)', () => {
    expect(readNumber(createSunCoronaMaterial(), 'uPeakOpacity')).toBe(1);
  });
});

describe('createSunHaloMaterial', () => {
  it('returns a ShaderMaterial instance', () => {
    expect(createSunHaloMaterial()).toBeInstanceOf(ShaderMaterial);
  });

  it('uses additive blending with depthWrite off and tone mapping off', () => {
    const m = createSunHaloMaterial();
    expect(m.blending).toBe(AdditiveBlending);
    expect(m.depthWrite).toBe(false);
    expect(m.transparent).toBe(true);
    expect(m.toneMapped).toBe(false);
  });

  it('exposes uPeakOpacity well below the corona (softer outer glow)', () => {
    const halo = readNumber(createSunHaloMaterial(), 'uPeakOpacity');
    const corona = readNumber(createSunCoronaMaterial(), 'uPeakOpacity');
    expect(halo).toBeLessThan(corona);
    expect(halo).toBeCloseTo(0.25, 5);
  });

  it('exposes a warmer rim color skewed toward orange compared to the corona rim', () => {
    const haloRim = readVec3(createSunHaloMaterial(), 'uColorRim');
    const coronaRim = readVec3(createSunCoronaMaterial(), 'uColorRim');
    expect(haloRim.z).toBeLessThan(coronaRim.z);
  });

  it('exposes uOpacityScale initialised to 1', () => {
    expect(readNumber(createSunHaloMaterial(), 'uOpacityScale')).toBe(1);
  });
});
