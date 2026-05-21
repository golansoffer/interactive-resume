import { asCompanyId, type CompanyEntry } from '../../types/company';

// Order: current role first (innermost +Z stop), oldest role last. The tuple
// shape carries the non-empty proof so downstream projections never need to
// guard for an empty route.
export const CAREER_ROUTE: readonly [
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
] = [
  {
    id: asCompanyId('mave'),
    planet: { assetId: 'saturn_b', placement: [80, 0, 80] },
    info: {
      companyName: 'Mave',
      logo: { kind: 'with_icon', src: '/icons/mave.svg', backdrop: 'light' },
      website: { kind: 'has_website', url: 'https://www.mave.com/' },
      role: 'Head of Platform',
      period: { kind: 'ongoing', start: { year: 2025, month: 1 } },
      description:
        "Employee #1, responsible for building the company's end-to-end product execution pipeline from ideation to production. Built the platform from scratch while defining the architecture, standards, and practices behind it. Partnered across product, design, R&D, and QA to drive technical decisions and scalable execution.",
    },
  },
  {
    id: asCompanyId('8fig'),
    planet: { assetId: 'jupiter_b', placement: [60, 0, 180] },
    info: {
      companyName: '8fig',
      logo: { kind: 'with_icon', src: '/icons/8fig.svg', backdrop: 'light' },
      website: { kind: 'has_website', url: 'https://www.8fig.co/' },
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
    planet: { assetId: 'mars_b', placement: [30, 0, 290] },
    info: {
      companyName: 'Riverside',
      logo: { kind: 'with_icon', src: '/icons/riverside.svg', backdrop: 'light' },
      website: { kind: 'has_website', url: 'https://riverside.com/' },
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
    planet: { assetId: 'earth_b', placement: [-10, 0, 400] },
    info: {
      companyName: 'StreamElements',
      logo: { kind: 'with_icon', src: '/icons/streamelements.svg', backdrop: 'dark' },
      website: { kind: 'has_website', url: 'https://streamelements.com/' },
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
    planet: { assetId: 'venus_b', placement: [-50, 0, 510] },
    info: {
      companyName: 'TGS',
      logo: { kind: 'no_icon' },
      website: { kind: 'no_website' },
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
] as const;

export const getCompanyEntries = (): ReadonlyArray<CompanyEntry> => CAREER_ROUTE;
