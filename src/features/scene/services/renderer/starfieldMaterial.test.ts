import { describe, expect, it } from 'vitest';
import { AdditiveBlending, Color, ShaderMaterial } from 'three';
import { buildStarfieldMaterial, type StarfieldMaterialParams } from './starfieldMaterial';

const PARAMS: StarfieldMaterialParams = {
  color: '#cfd9ff',
  twinkleSpeed: 1.6,
};

describe('buildStarfieldMaterial — instance', () => {
  it('returns a ShaderMaterial', () => {
    const material = buildStarfieldMaterial(PARAMS);
    expect(material).toBeInstanceOf(ShaderMaterial);
  });
});

describe('buildStarfieldMaterial — flags', () => {
  it('configures transparent, additive blending, no depth write', () => {
    const material = buildStarfieldMaterial(PARAMS);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(AdditiveBlending);
  });
});

describe('buildStarfieldMaterial — uniforms', () => {
  it('exposes uTime initialised to zero', () => {
    const material = buildStarfieldMaterial(PARAMS);
    const uTime = material.uniforms['uTime'];
    if (uTime === undefined) throw new Error('uTime uniform missing');
    expect(uTime.value).toBe(0);
  });

  it('exposes uTwinkleSpeed with the supplied value', () => {
    const material = buildStarfieldMaterial(PARAMS);
    const uTwinkleSpeed = material.uniforms['uTwinkleSpeed'];
    if (uTwinkleSpeed === undefined) throw new Error('uTwinkleSpeed uniform missing');
    expect(uTwinkleSpeed.value).toBe(1.6);
  });

  it('exposes uColor as a three.Color matching the input hex', () => {
    const material = buildStarfieldMaterial(PARAMS);
    const uColor = material.uniforms['uColor'];
    if (uColor === undefined) throw new Error('uColor uniform missing');
    const value: unknown = uColor.value;
    if (!(value instanceof Color)) throw new Error('uColor.value is not a Color');
    const expected = new Color('#cfd9ff');
    expect(value.r).toBeCloseTo(expected.r, 5);
    expect(value.g).toBeCloseTo(expected.g, 5);
    expect(value.b).toBeCloseTo(expected.b, 5);
  });

  it('exposes uPixelRatio with a positive number', () => {
    const material = buildStarfieldMaterial(PARAMS);
    const uPixelRatio = material.uniforms['uPixelRatio'];
    if (uPixelRatio === undefined) throw new Error('uPixelRatio uniform missing');
    const value = uPixelRatio.value;
    if (typeof value !== 'number') throw new Error('uPixelRatio.value is not a number');
    expect(value).toBeGreaterThan(0);
  });
});
