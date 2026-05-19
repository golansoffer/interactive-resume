import { asCompanyId } from '../../types/company';
import type { CompanyEntry } from '../../types/company';

const RING_RADIUS = 14;
const RING_COUNT = 5;

const ringPosition = (index: number): readonly [number, number, number] => {
  const angle = (index / RING_COUNT) * Math.PI * 2;
  const x = Math.cos(angle) * RING_RADIUS;
  const z = Math.sin(angle) * RING_RADIUS;
  return [x, 0, z];
};

const COMPANY_ENTRIES: ReadonlyArray<CompanyEntry> = [
  {
    id: asCompanyId('mave'),
    planet: { color: '#2dd4bf', placement: ringPosition(0) },
    info: {
      companyName: 'Mave',
      logoSrc: '/logos/mave.svg',
      role: 'Head of Platform',
      period: { kind: 'ongoing', start: { year: 2025, month: 1 } },
      description:
        "Employee #1, responsible for building the company's end-to-end product execution pipeline from ideation to production. Built the platform from scratch while defining the architecture, standards, and practices behind it. Partnered across product, design, R&D, and QA to drive technical decisions and scalable execution.",
    },
  },
  {
    id: asCompanyId('8fig'),
    planet: { color: '#f59e0b', placement: ringPosition(1) },
    info: {
      companyName: '8fig',
      logoSrc: '/logos/8fig.svg',
      role: 'Software Architect',
      period: {
        kind: 'closed',
        start: { year: 2023, month: 7 },
        end: { year: 2025, month: 1 },
      },
      description:
        "Owned critical product systems end to end, building the company's design system and turning ambiguous ideas into production-ready features. Re-architected the back-office platform and rebuilt the main dashboard, reducing load times from 8+ seconds to near-instant. Also set frontend quality standards, mentored engineers, and shaped the engineering interview process.",
    },
  },
  {
    id: asCompanyId('riverside'),
    planet: { color: '#ef4444', placement: ringPosition(2) },
    info: {
      companyName: 'Riverside',
      logoSrc: '/logos/riverside.svg',
      role: 'Group Lead',
      period: {
        kind: 'closed',
        start: { year: 2022, month: 5 },
        end: { year: 2023, month: 4 },
      },
      description:
        'Joined as the sole engineer on the Editor team and rebuilt a neglected product from scratch, creating a stable foundation for scale. Partnered with leadership on the roadmap and long-term vision, and introduced a clear workflow for feature scoping, delivery, and approval across teams. Also built the engineering interview process and served as technical and execution lead as the product scaled from roughly 100 users to nearly 1M.',
    },
  },
  {
    id: asCompanyId('streamelements'),
    planet: { color: '#8b5cf6', placement: ringPosition(3) },
    info: {
      companyName: 'StreamElements',
      logoSrc: '/logos/streamelements.svg',
      role: 'Senior Frontend Engineer',
      period: {
        kind: 'closed',
        start: { year: 2019, month: 10 },
        end: { year: 2022, month: 5 },
      },
      description:
        "Early engineer during the company's formative stage, building multiple products from scratch and leading rapid pivots as market conditions and priorities changed. During COVID-19, remained the sole engineer in the department after a major downsizing and owned critical initiatives during a high-pressure period. That work became foundational to the company's later growth, scale, and $100M SoftBank investment.",
    },
  },
  {
    id: asCompanyId('tgs'),
    planet: { color: '#06b6d4', placement: ringPosition(4) },
    info: {
      companyName: 'TGS',
      logoSrc: '/logos/tgs.svg',
      role: 'Frontend Engineer',
      period: {
        kind: 'closed',
        start: { year: 2018, month: 5 },
        end: { year: 2019, month: 10 },
      },
      description:
        'Frontend engineer on a complex, high-traffic travel engine used by major airline customers, including EasyJet and Singapore Airlines. Built a white-label frontend architecture for multiple enterprise clients.',
    },
  },
];

export const getCompanyEntries = (): ReadonlyArray<CompanyEntry> => COMPANY_ENTRIES;
