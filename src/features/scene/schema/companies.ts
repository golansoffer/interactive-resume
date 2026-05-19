import { type Company, asCompanyId } from '../types/company';

const RING_RADIUS = 12;
const RING_COUNT = 8;

const ringPosition = (index: number): readonly [number, number, number] => {
  const angle = (index / RING_COUNT) * Math.PI * 2;
  const x = Math.cos(angle) * RING_RADIUS;
  const z = Math.sin(angle) * RING_RADIUS;
  return [x, 0, z];
};

const FOUNDATION_COMPANIES: ReadonlyArray<Company> = [
  { id: asCompanyId('aether-systems'), position: ringPosition(0) },
  { id: asCompanyId('borealis-labs'), position: ringPosition(1) },
  { id: asCompanyId('cinder-collective'), position: ringPosition(2) },
  { id: asCompanyId('drift-dynamics'), position: ringPosition(3) },
  { id: asCompanyId('ember-works'), position: ringPosition(4) },
  { id: asCompanyId('flux-foundry'), position: ringPosition(5) },
  { id: asCompanyId('glacier-grove'), position: ringPosition(6) },
  { id: asCompanyId('helix-haus'), position: ringPosition(7) },
];

export const getFoundationCompanies = (): ReadonlyArray<Company> => FOUNDATION_COMPANIES;
