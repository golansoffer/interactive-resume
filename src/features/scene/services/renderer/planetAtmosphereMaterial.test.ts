import { describe, expect, it } from 'vitest';
import { AdditiveBlending, ShaderMaterial, Vector3 } from 'three';
import {
  createPlanetAtmosphereMaterial,
  type PlanetAtmosphereParams,
} from './planetAtmosphereMaterial';

const PARAMS: PlanetAtmosphereParams = {
  tint: [0.4, 0.7, 1],
  power: 3,
  opacity: 0.8,
  phase: 1.25,
};

describe('createPlanetAtmosphereMaterial — instance', () => {
  it('returns a ShaderMaterial instance', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    expect(material).toBeInstanceOf(ShaderMaterial);
  });
});

describe('createPlanetAtmosphereMaterial — uniforms', () => {
  it('exposes uTint as a Vector3 with the supplied linear RGB components', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    const uTint = material.uniforms['uTint'];
    if (uTint === undefined) throw new Error('uTint uniform missing');
    const value: unknown = uTint.value;
    if (!(value instanceof Vector3)) throw new Error('uTint.value is not a Vector3');
    expect(value.x).toBe(0.4);
    expect(value.y).toBe(0.7);
    expect(value.z).toBe(1);
  });

  it('exposes uPower with the supplied value', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    const uPower = material.uniforms['uPower'];
    if (uPower === undefined) throw new Error('uPower uniform missing');
    expect(uPower.value).toBe(3);
  });

  it('exposes uOpacity with the supplied value', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    const uOpacity = material.uniforms['uOpacity'];
    if (uOpacity === undefined) throw new Error('uOpacity uniform missing');
    expect(uOpacity.value).toBe(0.8);
  });

  it('exposes uTime initialised to 0', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    const uTime = material.uniforms['uTime'];
    if (uTime === undefined) throw new Error('uTime uniform missing');
    expect(uTime.value).toBe(0);
  });

  it('exposes uPhase with the supplied phase value', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    const uPhase = material.uniforms['uPhase'];
    if (uPhase === undefined) throw new Error('uPhase uniform missing');
    expect(uPhase.value).toBe(1.25);
  });
});

describe('createPlanetAtmosphereMaterial — material settings', () => {
  it('sets transparent to true', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    expect(material.transparent).toBe(true);
  });

  it('sets depthWrite to false', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    expect(material.depthWrite).toBe(false);
  });

  it('sets blending to AdditiveBlending', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    expect(material.blending).toBe(AdditiveBlending);
  });
});

describe('createPlanetAtmosphereMaterial — uniform mutability', () => {
  it('reflects external writes to uOpacity.value after construction', () => {
    const material = createPlanetAtmosphereMaterial(PARAMS);
    const uOpacity = material.uniforms['uOpacity'];
    if (uOpacity === undefined) throw new Error('uOpacity uniform missing');
    uOpacity.value = 0.5;
    const readBack = material.uniforms['uOpacity'];
    if (readBack === undefined) throw new Error('uOpacity uniform missing on re-read');
    expect(readBack.value).toBe(0.5);
  });
});
