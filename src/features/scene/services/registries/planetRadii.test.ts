import { describe, expect, it } from 'vitest';
import { createPlanetRadii } from './planetRadii';
import { asCompanyId } from '../../types/company';
import type { CompanyInfo } from '../../types/company-info';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');

const info = (companyName: string): CompanyInfo => ({
  companyName,
  logo: { kind: 'no_icon' },
  website: { kind: 'no_website' },
  role: 'role',
  period: { kind: 'ongoing', start: { year: 2024, month: 1 } },
  oneLiner: 'one-liner',
  hook: 'hook',
  decision: { kind: 'none' },
  work: ['work'],
  departure: { kind: 'current_role' },
});

const placeA = [0, 0, 70] as const;
const placeB = [0, 0, 170] as const;

describe('createPlanetRadii', () => {
  it('forEach yields nothing before any attach', () => {
    const radii = createPlanetRadii();
    const seen: string[] = [];
    radii.forEach((id) => seen.push(id));
    expect(seen).toEqual([]);
  });

  it('after attach, forEach yields the attached entry with the cell value', () => {
    const radii = createPlanetRadii();
    const cell = radii.attach(mave, info('Mave'), placeA);
    cell.value = 12.5;
    const seen: Array<{ id: string; radius: number; companyName: string }> = [];
    radii.forEach((id, i, _placement, radius) =>
      seen.push({ id, radius, companyName: i.companyName }),
    );
    expect(seen).toEqual([{ id: mave, radius: 12.5, companyName: 'Mave' }]);
  });

  it('cell mutations are observable through subsequent forEach iterations', () => {
    const radii = createPlanetRadii();
    const cell = radii.attach(mave, info('Mave'), placeA);
    cell.value = 1;
    let firstSeen = -1;
    radii.forEach((_id, _i, _p, r) => {
      firstSeen = r;
    });
    cell.value = 9;
    let secondSeen = -1;
    radii.forEach((_id, _i, _p, r) => {
      secondSeen = r;
    });
    expect(firstSeen).toBe(1);
    expect(secondSeen).toBe(9);
  });

  it('re-attaching the same id replaces the prior cell (StrictMode-safe)', () => {
    const radii = createPlanetRadii();
    const first = radii.attach(mave, info('Mave-old'), placeA);
    first.value = 100;
    const second = radii.attach(mave, info('Mave-new'), placeA);
    second.value = 5;
    const seen: Array<{ companyName: string; radius: number }> = [];
    radii.forEach((_id, i, _p, r) => seen.push({ companyName: i.companyName, radius: r }));
    expect(seen).toEqual([{ companyName: 'Mave-new', radius: 5 }]);
  });

  it('multiple distinct ids accumulate as separate entries', () => {
    const radii = createPlanetRadii();
    radii.attach(mave, info('Mave'), placeA).value = 10;
    radii.attach(eightfig, info('8fig'), placeB).value = 20;
    const ids = new Set<string>();
    radii.forEach((id) => ids.add(id));
    expect(ids.size).toBe(2);
    expect(ids).toContain(mave);
    expect(ids).toContain(eightfig);
  });
});
