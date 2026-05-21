import type { CompanyId } from '../../types/company';
import type { PlanetActivations } from '../../types/scene-refs';

export const createPlanetActivations = (): PlanetActivations => {
  let active: ReadonlySet<CompanyId> = new Set();
  return {
    isActive: (id) => active.has(id),
    anyActive: () => active.size > 0,
    snapshot: () => active,
    publish: (next) => {
      active = next;
    },
  };
};
