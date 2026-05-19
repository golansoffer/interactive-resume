import { describe, expect, it } from 'vitest';
import { asCompanyId, type Company } from '../../types/company';
import { proximityCheck } from './proximityCheck';
import type { Vec3 } from './vec3';

const PLAYER: Vec3 = { x: 0, y: 0, z: 0 };

const company = (id: string, position: readonly [number, number, number]): Company => ({
  id: asCompanyId(id),
  position,
});

describe('proximityCheck', () => {
  it('returns an empty set when the companies list is empty', () => {
    const result = proximityCheck(PLAYER, [], 5);
    expect(result.size).toBe(0);
  });

  it('returns an empty set when no company lies within the radius', () => {
    const result = proximityCheck(PLAYER, [company('far', [100, 0, 0])], 5);
    expect(result.size).toBe(0);
  });

  it('returns a set containing exactly the id of a company strictly inside the radius', () => {
    const result = proximityCheck(PLAYER, [company('near', [2, 0, 0])], 5);
    expect(result.size).toBe(1);
    expect(result.has(asCompanyId('near'))).toBe(true);
  });

  it('excludes a company strictly outside the radius', () => {
    const result = proximityCheck(PLAYER, [company('out', [10, 0, 0])], 5);
    expect(result.has(asCompanyId('out'))).toBe(false);
  });

  it('includes a company exactly on the radius boundary (closed-disk semantics)', () => {
    const result = proximityCheck(PLAYER, [company('boundary', [5, 0, 0])], 5);
    expect(result.has(asCompanyId('boundary'))).toBe(true);
  });

  it('computes Euclidean distance across all three axes (a company at (3,4,0) is on a radius-5 boundary)', () => {
    const result = proximityCheck(PLAYER, [company('pythag', [3, 4, 0])], 5);
    expect(result.has(asCompanyId('pythag'))).toBe(true);
  });

  it('excludes a company whose 3D distance exceeds the radius even when its 2D projection lies inside', () => {
    const result = proximityCheck(PLAYER, [company('above', [3, 4, 1])], 5);
    expect(result.has(asCompanyId('above'))).toBe(false);
  });

  it('returns every in-range company id when several lie inside the radius (independence across companies)', () => {
    const companies = [
      company('a', [1, 0, 0]),
      company('b', [0, 1, 0]),
      company('c', [0, 0, 1]),
    ];
    const result = proximityCheck(PLAYER, companies, 5);
    expect(result.size).toBe(3);
    expect(result.has(asCompanyId('a'))).toBe(true);
    expect(result.has(asCompanyId('b'))).toBe(true);
    expect(result.has(asCompanyId('c'))).toBe(true);
  });

  it('returns only in-range ids when a mixed list contains both in-range and out-of-range companies', () => {
    const companies = [
      company('in', [1, 0, 0]),
      company('out', [0, 0, 100]),
      company('also-in', [0, 2, 0]),
    ];
    const result = proximityCheck(PLAYER, companies, 5);
    expect(result.has(asCompanyId('in'))).toBe(true);
    expect(result.has(asCompanyId('also-in'))).toBe(true);
    expect(result.has(asCompanyId('out'))).toBe(false);
  });

  it('respects the radius parameter independently per call (same player + companies; different radius => different result)', () => {
    const companies = [company('mid', [4, 0, 0])];
    const wide = proximityCheck(PLAYER, companies, 5);
    const narrow = proximityCheck(PLAYER, companies, 3);
    expect(wide.has(asCompanyId('mid'))).toBe(true);
    expect(narrow.has(asCompanyId('mid'))).toBe(false);
  });

  it('returns deeply unchanged input objects (no mutation of player position, companies array, or individual company records)', () => {
    const playerSnapshot: Vec3 = { x: PLAYER.x, y: PLAYER.y, z: PLAYER.z };
    const companies = [company('a', [1, 2, 3]), company('b', [4, 5, 6])];
    const companiesSnapshot = companies.map((c) => ({ id: c.id, position: c.position }));
    proximityCheck(PLAYER, companies, 5);
    expect(PLAYER).toEqual(playerSnapshot);
    expect(companies).toEqual(companiesSnapshot);
  });

  it('returns a fresh set instance on each call (no cached / mutated singleton)', () => {
    const companies = [company('a', [1, 0, 0])];
    const first = proximityCheck(PLAYER, companies, 5);
    const second = proximityCheck(PLAYER, companies, 5);
    expect(first).not.toBe(second);
  });
});
