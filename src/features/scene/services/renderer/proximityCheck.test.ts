import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../types/company';
import type { CompanyId } from '../../types/company';
import { proximityCheck } from './proximityCheck';
import type { Vec3 } from './vec3';

type TestTarget = {
  readonly id: CompanyId;
  readonly placement: readonly [number, number, number];
  readonly radius: number;
};

const PLAYER: Vec3 = { x: 0, y: 0, z: 0 };

const target = (
  id: string,
  placement: readonly [number, number, number],
  radius: number,
): TestTarget => ({ id: asCompanyId(id), placement, radius });

const idsOf = (matches: ReadonlyArray<TestTarget>): ReadonlySet<CompanyId> =>
  new Set(matches.map((m) => m.id));

describe('proximityCheck', () => {
  it('returns an empty array when the targets list is empty', () => {
    const result = proximityCheck(PLAYER, []);
    expect(result.length).toBe(0);
  });

  it('returns an empty array when no target lies within its radius', () => {
    const result = proximityCheck(PLAYER, [target('far', [100, 0, 0], 5)]);
    expect(result.length).toBe(0);
  });

  it('includes a target strictly inside its radius', () => {
    const result = proximityCheck(PLAYER, [target('near', [2, 0, 0], 5)]);
    expect(result.length).toBe(1);
    expect(idsOf(result).has(asCompanyId('near'))).toBe(true);
  });

  it('excludes a target strictly outside its radius', () => {
    const result = proximityCheck(PLAYER, [target('out', [10, 0, 0], 5)]);
    expect(idsOf(result).has(asCompanyId('out'))).toBe(false);
  });

  it('includes a target exactly on its radius boundary (closed-disk semantics)', () => {
    const result = proximityCheck(PLAYER, [target('boundary', [5, 0, 0], 5)]);
    expect(idsOf(result).has(asCompanyId('boundary'))).toBe(true);
  });

  it('computes Euclidean distance across all three axes', () => {
    const result = proximityCheck(PLAYER, [target('pythag', [3, 4, 0], 5)]);
    expect(idsOf(result).has(asCompanyId('pythag'))).toBe(true);
  });

  it('excludes a target whose 3D distance exceeds its radius even when its 2D projection lies inside', () => {
    const result = proximityCheck(PLAYER, [target('above', [3, 4, 1], 5)]);
    expect(idsOf(result).has(asCompanyId('above'))).toBe(false);
  });

  it('returns every in-range target when several lie inside their radii (independence across targets)', () => {
    const targets = [
      target('a', [1, 0, 0], 5),
      target('b', [0, 1, 0], 5),
      target('c', [0, 0, 1], 5),
    ];
    const result = proximityCheck(PLAYER, targets);
    expect(result.length).toBe(3);
    const ids = idsOf(result);
    expect(ids.has(asCompanyId('a'))).toBe(true);
    expect(ids.has(asCompanyId('b'))).toBe(true);
    expect(ids.has(asCompanyId('c'))).toBe(true);
  });

  it('returns only in-range targets when a mixed list contains both in-range and out-of-range', () => {
    const targets = [
      target('in', [1, 0, 0], 5),
      target('out', [0, 0, 100], 5),
      target('also-in', [0, 2, 0], 5),
    ];
    const result = proximityCheck(PLAYER, targets);
    const ids = idsOf(result);
    expect(ids.has(asCompanyId('in'))).toBe(true);
    expect(ids.has(asCompanyId('also-in'))).toBe(true);
    expect(ids.has(asCompanyId('out'))).toBe(false);
  });

  it('respects each target radius independently — same player, different targets, different radii', () => {
    const targets = [target('mid-wide', [4, 0, 0], 5), target('mid-narrow', [4, 0, 0], 3)];
    const result = proximityCheck(PLAYER, targets);
    const ids = idsOf(result);
    expect(ids.has(asCompanyId('mid-wide'))).toBe(true);
    expect(ids.has(asCompanyId('mid-narrow'))).toBe(false);
  });

  it('does not mutate inputs', () => {
    const playerSnapshot: Vec3 = { x: PLAYER.x, y: PLAYER.y, z: PLAYER.z };
    const targets = [target('a', [1, 2, 3], 5), target('b', [4, 5, 6], 5)];
    const targetsSnapshot = targets.map((t) => ({
      id: t.id,
      placement: t.placement,
      radius: t.radius,
    }));
    proximityCheck(PLAYER, targets);
    expect(PLAYER).toEqual(playerSnapshot);
    expect(targets).toEqual(targetsSnapshot);
  });

  it('returns a fresh array instance on each call', () => {
    const targets = [target('a', [1, 0, 0], 5)];
    const first = proximityCheck(PLAYER, targets);
    const second = proximityCheck(PLAYER, targets);
    expect(first).not.toBe(second);
  });
});
