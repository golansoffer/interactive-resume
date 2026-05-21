import { describe, expect, it } from 'vitest';
import { AdditiveBlending, Color, ShaderMaterial } from 'three';
import { buildStarfieldMaterial, type StarfieldMaterialParams } from './starfieldMaterial';

const PARAMS: StarfieldMaterialParams = {
  color: '#cfd9ff',
};

const getUniform = (material: ShaderMaterial, key: string): { readonly value: unknown } => {
  const u = material.uniforms[key];
  if (u === undefined) throw new Error(`uniform ${key} missing`);
  return u;
};

describe('buildStarfieldMaterial — instance + flags', () => {
  it('returns a ShaderMaterial with transparent additive blending and no depth write', () => {
    const material = buildStarfieldMaterial(PARAMS);
    expect(material).toBeInstanceOf(ShaderMaterial);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(AdditiveBlending);
  });
});

describe('buildStarfieldMaterial — uniforms', () => {
  it('exposes uTime initialised to zero', () => {
    expect(getUniform(buildStarfieldMaterial(PARAMS), 'uTime').value).toBe(0);
  });

  it('exposes uColor as a three.Color matching the input hex', () => {
    const value: unknown = getUniform(buildStarfieldMaterial(PARAMS), 'uColor').value;
    if (!(value instanceof Color)) throw new Error('uColor.value is not a Color');
    const expected = new Color('#cfd9ff');
    expect(value.r).toBeCloseTo(expected.r, 5);
    expect(value.g).toBeCloseTo(expected.g, 5);
    expect(value.b).toBeCloseTo(expected.b, 5);
  });

  it('exposes uPixelRatio with a positive number', () => {
    const value: unknown = getUniform(buildStarfieldMaterial(PARAMS), 'uPixelRatio').value;
    if (typeof value !== 'number') throw new Error('uPixelRatio.value is not a number');
    expect(value).toBeGreaterThan(0);
  });

  it('exposes uHaloSizeBoost, uHaloStrength, uSpikeStrength with positive defaults', () => {
    const material = buildStarfieldMaterial(PARAMS);
    for (const key of ['uHaloSizeBoost', 'uHaloStrength', 'uSpikeStrength'] as const) {
      const value: unknown = getUniform(material, key).value;
      if (typeof value !== 'number') throw new Error(`${key}.value is not a number`);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('does not expose uTwinkleSpeed (replaced by per-star aTwinkleSpeed)', () => {
    expect(buildStarfieldMaterial(PARAMS).uniforms['uTwinkleSpeed']).toBeUndefined();
  });
});

describe('buildStarfieldMaterial — shader source', () => {
  it('references the new per-star attributes in the vertex shader', () => {
    const src = buildStarfieldMaterial(PARAMS).vertexShader;
    expect(src).toContain('aColor');
    expect(src).toContain('aLuminous');
    expect(src).toContain('aTwinkleSpeed');
    expect(src).toContain('aTwinkleSharp');
    expect(src).toContain('aSize');
    expect(src).toContain('aBrightness');
    expect(src).toContain('aTwinkleAmp');
    expect(src).toContain('aTwinklePhase');
  });

  it('blends smooth and sharp twinkle curves via aTwinkleSharp', () => {
    const src = buildStarfieldMaterial(PARAMS).vertexShader;
    expect(src).toMatch(/mix\(\s*[a-zA-Z_]+\s*,\s*[a-zA-Z_]+\s*,\s*aTwinkleSharp\s*\)/u);
  });

  it('enlarges gl_PointSize for luminous stars via uHaloSizeBoost', () => {
    const src = buildStarfieldMaterial(PARAMS).vertexShader;
    expect(src).toContain('uHaloSizeBoost');
    expect(src).toMatch(/gl_PointSize\s*=[^;]*aLuminous\s*\*\s*uHaloSizeBoost/u);
  });

  it('varies vColor, vLuminous, vAlpha out of the vertex shader', () => {
    const src = buildStarfieldMaterial(PARAMS).vertexShader;
    expect(src).toContain('vColor');
    expect(src).toContain('vLuminous');
    expect(src).toContain('vAlpha');
  });

  it('reads vColor and vAlpha in the fragment shader (vLuminous is consumed in Task 4)', () => {
    const src = buildStarfieldMaterial(PARAMS).fragmentShader;
    expect(src).toContain('vColor');
    expect(src).toContain('vAlpha');
  });

  it('multiplies fragment colour by vColor so per-star tint reaches the output', () => {
    const src = buildStarfieldMaterial(PARAMS).fragmentShader;
    expect(src).toMatch(/uColor\s*\*\s*vColor|vColor\s*\*\s*uColor/u);
  });
});
