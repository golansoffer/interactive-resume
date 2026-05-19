import { describe, expect, it } from 'vitest';
import { BackSide, ShaderMaterial, Vector3 } from 'three';
import { createNebulaSkyMaterial } from './nebulaSkyMaterial';
import type { NebulaPalette } from './deepSpacePalette';

const PALETTE: NebulaPalette = {
  base: [0.06, 0.04, 0.14],
  accent: [0.12, 0.32, 0.36],
  highlight: [0.95, 0.72, 0.45],
};

describe('createNebulaSkyMaterial — instance', () => {
  it('returns a ShaderMaterial', () => {
    expect(createNebulaSkyMaterial(PALETTE)).toBeInstanceOf(ShaderMaterial);
  });
});

describe('createNebulaSkyMaterial — uniforms', () => {
  it('exposes uTime initialised to 0', () => {
    const m = createNebulaSkyMaterial(PALETTE);
    const u = m.uniforms['uTime'];
    if (u === undefined) throw new Error('uTime missing');
    expect(u.value).toBe(0);
  });

  it('exposes uIntensity initialised to 1', () => {
    const m = createNebulaSkyMaterial(PALETTE);
    const u = m.uniforms['uIntensity'];
    if (u === undefined) throw new Error('uIntensity missing');
    expect(u.value).toBe(1);
  });

  it('exposes uBaseColor as a Vector3 matching palette.base', () => {
    const m = createNebulaSkyMaterial(PALETTE);
    const u = m.uniforms['uBaseColor'];
    if (u === undefined) throw new Error('uBaseColor missing');
    const v: unknown = u.value;
    if (!(v instanceof Vector3)) throw new Error('uBaseColor.value is not Vector3');
    expect(v.x).toBeCloseTo(0.06, 12);
    expect(v.y).toBeCloseTo(0.04, 12);
    expect(v.z).toBeCloseTo(0.14, 12);
  });

  it('exposes uAccentColor as a Vector3 matching palette.accent', () => {
    const m = createNebulaSkyMaterial(PALETTE);
    const u = m.uniforms['uAccentColor'];
    if (u === undefined) throw new Error('uAccentColor missing');
    const v: unknown = u.value;
    if (!(v instanceof Vector3)) throw new Error('uAccentColor.value is not Vector3');
    expect(v.x).toBeCloseTo(0.12, 12);
    expect(v.y).toBeCloseTo(0.32, 12);
    expect(v.z).toBeCloseTo(0.36, 12);
  });

  it('exposes uHighlightColor as a Vector3 matching palette.highlight', () => {
    const m = createNebulaSkyMaterial(PALETTE);
    const u = m.uniforms['uHighlightColor'];
    if (u === undefined) throw new Error('uHighlightColor missing');
    const v: unknown = u.value;
    if (!(v instanceof Vector3)) throw new Error('uHighlightColor.value is not Vector3');
    expect(v.x).toBeCloseTo(0.95, 12);
    expect(v.y).toBeCloseTo(0.72, 12);
    expect(v.z).toBeCloseTo(0.45, 12);
  });
});

describe('createNebulaSkyMaterial — material settings', () => {
  it('renders on BackSide (inside-out sphere)', () => {
    expect(createNebulaSkyMaterial(PALETTE).side).toBe(BackSide);
  });

  it('has depthWrite disabled (background)', () => {
    expect(createNebulaSkyMaterial(PALETTE).depthWrite).toBe(false);
  });

  it('has depthTest disabled (so it never occludes foreground)', () => {
    expect(createNebulaSkyMaterial(PALETTE).depthTest).toBe(false);
  });
});

describe('createNebulaSkyMaterial — mutability', () => {
  it('reflects external writes to uTime.value', () => {
    const m = createNebulaSkyMaterial(PALETTE);
    const u = m.uniforms['uTime'];
    if (u === undefined) throw new Error('uTime missing');
    u.value = 12.5;
    const read = m.uniforms['uTime'];
    if (read === undefined) throw new Error('uTime missing on re-read');
    expect(read.value).toBe(12.5);
  });
});
