import { describe, expect, it } from 'vitest';
import { getCompanyEntries } from './companies';

const findById = (id: string) => {
  const match = getCompanyEntries().find((e) => e.id === id);
  if (match === undefined) {
    throw new Error(`expected entry with id "${id}" to exist`);
  }
  return match;
};

describe('getCompanyEntries', () => {
  it('returns exactly five entries', () => {
    expect(getCompanyEntries()).toHaveLength(5);
  });

  it('every CompanyId is unique', () => {
    const ids = getCompanyEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry carries a non-empty companyName, role, and description', () => {
    for (const entry of getCompanyEntries()) {
      expect(entry.info.companyName.length).toBeGreaterThan(0);
      expect(entry.info.role.length).toBeGreaterThan(0);
      expect(entry.info.description.length).toBeGreaterThan(0);
    }
  });

  it("every entry's info.logo.kind is one of 'with_icon' | 'no_icon'", () => {
    for (const entry of getCompanyEntries()) {
      expect(['with_icon', 'no_icon']).toContain(entry.info.logo.kind);
    }
  });

  it("every with_icon entry's src starts with '/icons/' and ends with '.svg'", () => {
    for (const entry of getCompanyEntries()) {
      const logo = entry.info.logo;
      if (logo.kind === 'with_icon') {
        expect(logo.src.startsWith('/icons/')).toBe(true);
        expect(logo.src.endsWith('.svg')).toBe(true);
      }
    }
  });

  it("every with_icon entry's backdrop is one of 'light' | 'dark'", () => {
    for (const entry of getCompanyEntries()) {
      const logo = entry.info.logo;
      if (logo.kind === 'with_icon') {
        expect(['light', 'dark']).toContain(logo.backdrop);
      }
    }
  });

  it('mave entry carries the expected with_icon logo', () => {
    expect(findById('mave').info.logo).toEqual({
      kind: 'with_icon',
      src: '/icons/mave.svg',
      backdrop: 'light',
    });
  });

  it('8fig entry carries the expected with_icon logo', () => {
    expect(findById('8fig').info.logo).toEqual({
      kind: 'with_icon',
      src: '/icons/8fig.svg',
      backdrop: 'light',
    });
  });

  it('riverside entry carries the expected with_icon logo', () => {
    expect(findById('riverside').info.logo).toEqual({
      kind: 'with_icon',
      src: '/icons/riverside.svg',
      backdrop: 'light',
    });
  });

  it('streamelements entry carries the expected with_icon logo (dark backdrop)', () => {
    expect(findById('streamelements').info.logo).toEqual({
      kind: 'with_icon',
      src: '/icons/streamelements.svg',
      backdrop: 'dark',
    });
  });

  it("tgs entry's info.logo.kind equals 'no_icon'", () => {
    expect(findById('tgs').info.logo.kind).toBe('no_icon');
  });

  it("at least one entry has logo.kind = 'no_icon' (guards against future drop)", () => {
    const anyNoIcon = getCompanyEntries().some((e) => e.info.logo.kind === 'no_icon');
    expect(anyNoIcon).toBe(true);
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
});
