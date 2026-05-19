import { describe, expect, it } from 'vitest';
import { getCompanyEntries } from './companies';

describe('getCompanyEntries', () => {
  it('returns exactly five entries', () => {
    expect(getCompanyEntries()).toHaveLength(5);
  });

  it('every CompanyId is unique', () => {
    const ids = getCompanyEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry carries a non-empty companyName, role, logoSrc, and description', () => {
    for (const entry of getCompanyEntries()) {
      expect(entry.info.companyName.length).toBeGreaterThan(0);
      expect(entry.info.role.length).toBeGreaterThan(0);
      expect(entry.info.logoSrc.length).toBeGreaterThan(0);
      expect(entry.info.description.length).toBeGreaterThan(0);
    }
  });

  it('every entry carries a YearMonth start with year ≥ 2000', () => {
    // month range is enforced structurally by `Month = 1 | ... | 12`; not retested here.
    for (const entry of getCompanyEntries()) {
      expect(entry.info.period.start.year).toBeGreaterThanOrEqual(2000);
    }
  });

  it('every closed period has an end YearMonth ≥ start YearMonth', () => {
    for (const entry of getCompanyEntries()) {
      const period = entry.info.period;
      if (period.kind === 'closed') {
        const startKey = period.start.year * 12 + period.start.month;
        const endKey = period.end.year * 12 + period.end.month;
        expect(endKey).toBeGreaterThanOrEqual(startKey);
      }
    }
  });

  it('every PlanetAssetId is within the closed union (planet00..planet09)', () => {
    const valid = new Set([
      'planet00',
      'planet01',
      'planet02',
      'planet03',
      'planet04',
      'planet05',
      'planet06',
      'planet07',
      'planet08',
      'planet09',
    ]);
    for (const entry of getCompanyEntries()) {
      expect(valid.has(entry.planet.assetId)).toBe(true);
    }
  });
});
