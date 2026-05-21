import type { CompanyId } from '../../types/company';
import type { CompanyInfo } from '../../types/company-info';
import type { PlanetRadii } from '../../types/scene-refs';

// Per-planet proximity-target entries. attach yields a mutable radius cell;
// forEach iterates complete (id, info, placement, radius) tuples so callers
// never perform id-keyed lookups. Re-attaching the same id replaces the
// entry (StrictMode-safe).
type Entry = {
  readonly info: CompanyInfo;
  readonly placement: readonly [number, number, number];
  readonly cell: { value: number };
};

export const createPlanetRadii = (): PlanetRadii => {
  const entries = new Map<CompanyId, Entry>();
  return {
    attach: (id, info, placement) => {
      const cell = { value: 0 };
      entries.set(id, { info, placement, cell });
      return cell;
    },
    forEach: (callback) => {
      entries.forEach((entry, id) => callback(id, entry.info, entry.placement, entry.cell.value));
    },
  };
};
