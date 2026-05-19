import type { Company, CompanyId } from '../../types/company';
import type { Vec3 } from './vec3';

export const proximityCheck = (
  playerPosition: Vec3,
  companies: ReadonlyArray<Company>,
  radius: number,
): ReadonlySet<CompanyId> => {
  const result = new Set<CompanyId>();
  const limitSquared = radius * radius;
  for (const company of companies) {
    const [cx, cy, cz] = company.position;
    const dx = cx - playerPosition.x;
    const dy = cy - playerPosition.y;
    const dz = cz - playerPosition.z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared <= limitSquared) {
      result.add(company.id);
    }
  }
  return result;
};
