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

  it('every entry carries non-empty companyName, role, oneLiner, hook, and at least one work bullet', () => {
    for (const entry of getCompanyEntries()) {
      expect(entry.info.companyName.length).toBeGreaterThan(0);
      expect(entry.info.role.length).toBeGreaterThan(0);
      expect(entry.info.oneLiner.length).toBeGreaterThan(0);
      expect(entry.info.hook.length).toBeGreaterThan(0);
      expect(entry.info.work.length).toBeGreaterThan(0);
    }
  });

  it("every entry's decision is either 'recorded' with text or 'none'", () => {
    for (const entry of getCompanyEntries()) {
      const decision = entry.info.decision;
      if (decision.kind === 'recorded') {
        expect(decision.text.length).toBeGreaterThan(0);
      } else {
        expect(decision.kind).toBe('none');
      }
    }
  });

  it("every entry's departure is one of 'current_role' | 'moved_on' | 'undisclosed'", () => {
    for (const entry of getCompanyEntries()) {
      expect(['current_role', 'moved_on', 'undisclosed']).toContain(entry.info.departure.kind);
    }
  });

  it("ongoing roles use departure 'current_role'; closed roles do not", () => {
    for (const entry of getCompanyEntries()) {
      if (entry.info.period.kind === 'ongoing') {
        expect(entry.info.departure.kind).toBe('current_role');
      } else {
        expect(entry.info.departure.kind).not.toBe('current_role');
      }
    }
  });

  it("every entry's info.logo.kind is one of 'with_icon' | 'text_label' | 'no_icon'", () => {
    for (const entry of getCompanyEntries()) {
      expect(['with_icon', 'text_label', 'no_icon']).toContain(entry.info.logo.kind);
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

  it("tgs entry carries a text_label logo with text 'TGS' and light backdrop", () => {
    expect(findById('tgs').info.logo).toEqual({
      kind: 'text_label',
      text: 'TGS',
      backdrop: 'light',
    });
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

  it('every entry carries a non-empty short code', () => {
    for (const entry of getCompanyEntries()) {
      expect(entry.shortCode.length).toBeGreaterThan(0);
    }
  });

  it('mave entry has shortCode "MAV"', () => {
    expect(findById('mave').shortCode).toBe('MAV');
  });

  it('8fig entry has shortCode "8FG"', () => {
    expect(findById('8fig').shortCode).toBe('8FG');
  });

  it('riverside entry has shortCode "RVS"', () => {
    expect(findById('riverside').shortCode).toBe('RVS');
  });

  it('streamelements entry has shortCode "STE"', () => {
    expect(findById('streamelements').shortCode).toBe('STE');
  });

  it('tgs entry has shortCode "TGS"', () => {
    expect(findById('tgs').shortCode).toBe('TGS');
  });
});
