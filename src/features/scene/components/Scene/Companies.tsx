import type { JSX } from 'react';
import type { Company, CompanyId } from '../../types/company';

type CompaniesProps = {
  readonly companies: ReadonlyArray<Company>;
};

const COMPANY_SIZE = 1.2;

const HUE_ENCODER = new TextEncoder();

const hueFromId = (id: CompanyId): number => {
  const bytes = HUE_ENCODER.encode(id);
  let hue = 0;
  for (const byte of bytes) {
    hue = (hue * 31 + byte) % 360;
  }
  return hue;
};

const colorFromId = (id: CompanyId): string => `hsl(${hueFromId(id)}, 70%, 55%)`;

export const Companies = (props: CompaniesProps): JSX.Element => (
  <group>
    {props.companies.map((company) => (
      <mesh key={company.id} position={company.position}>
        <boxGeometry args={[COMPANY_SIZE, COMPANY_SIZE, COMPANY_SIZE]} />
        <meshStandardMaterial color={colorFromId(company.id)} />
      </mesh>
    ))}
  </group>
);
