import { asCompanyId, type CompanyEntry } from '../../types/company';

// Order: most recent role first (innermost +Z stop), oldest role last. The
// tuple shape proves the route is never empty, so downstream projections
// never need to guard for an empty case.
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
      period: {
        kind: 'closed',
        start: { year: 2025, month: 1 },
        end: { year: 2026, month: 4 },
      },
      oneLiner: 'Agentic SecOps platform for threat detection and response.',
      hook: 'Employee **#1**.',
      decision: { kind: 'none' },
      work: [
        'Built the product execution pipeline from ideation to production.',
        'Built the platform from scratch and defined the architecture, standards, and practices behind it.',
        'Worked directly with product and design on the technical decisions that shaped how we shipped.',
      ],
      departure: { kind: 'undisclosed' },
    },
  },
  {
    id: asCompanyId('8fig'),
    planet: { assetId: 'jupiter_b', placement: [60, 0, 180] },
    info: {
      companyName: '8fig',
      logo: { kind: 'with_icon', src: '/icons/8fig.svg', backdrop: 'light' },
      website: { kind: 'has_website', url: 'https://www.8fig.co/' },
      role: 'Frontend Architect',
      period: {
        kind: 'closed',
        start: { year: 2023, month: 7 },
        end: { year: 2025, month: 1 },
      },
      oneLiner: 'Funds Amazon and Shopify sellers without taking equity.',
      hook: 'Rebuilt the main dashboard.\n**8 seconds to near instant**.',
      decision: { kind: 'none' },
      work: [
        'Built the design system from scratch as the foundation for all subsequent frontend work.',
        'Rearchitected the back office platform used by support and risk teams. Led the dashboard rebuild that replaced the legacy implementation.',
        'Set frontend quality standards, mentored engineers, and designed the engineering interview pipeline.',
      ],
      departure: { kind: 'undisclosed' },
    },
  },
  {
    id: asCompanyId('riverside'),
    planet: { assetId: 'mars_b', placement: [30, 0, 290] },
    info: {
      companyName: 'Riverside.fm',
      logo: { kind: 'with_icon', src: '/icons/riverside.svg', backdrop: 'light' },
      website: { kind: 'has_website', url: 'https://riverside.com/' },
      role: 'Group Tech Lead',
      period: {
        kind: 'closed',
        start: { year: 2022, month: 5 },
        end: { year: 2023, month: 4 },
      },
      oneLiner:
        'Studio in the browser for podcast and video recording, editing, and distribution.',
      hook: 'First engineer on a neglected Editor product. Scaled it from **~100 users to ~1M**.',
      decision: {
        kind: 'recorded',
        text: 'Made the call to deprecate the existing implementation and rebuilt the editor from scratch to give it a foundation worth scaling on.',
      },
      work: [
        'After the rebuild, partnered with management on the product roadmap and long term vision.',
        'Identified breakdowns in cross department communication and designed the workflow that fixed it: feature definition, delivery, and stakeholder approval across product, engineering, and leadership.',
        'Built the engineering interview process and acted as technical and execution lead through the scale up.',
      ],
      departure: { kind: 'undisclosed' },
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
      oneLiner: 'Live streaming tools. Overlays, alerts, chatbot, monetization.',
      hook: 'Sole engineer in the department through the COVID downsizing.',
      decision: { kind: 'none' },
      work: [
        'Built multiple products from scratch and rode rapid pivots as market conditions and business priorities shifted.',
        'Owned critical initiatives during the high pressure period after the downsizing.',
        'Built the product capabilities that later drove significant scale and culminated in the company\'s **$100M investment from SoftBank**.',
      ],
      departure: { kind: 'undisclosed' },
    },
  },
  {
    id: asCompanyId('tgs'),
    planet: { assetId: 'venus_b', placement: [-50, 0, 510] },
    info: {
      companyName: 'TGS',
      logo: { kind: 'text_label', text: 'TGS', backdrop: 'light' },
      website: { kind: 'no_website' },
      role: 'Frontend Engineer',
      period: {
        kind: 'closed',
        start: { year: 2018, month: 5 },
        end: { year: 2019, month: 10 },
      },
      oneLiner: 'White label travel booking engine for major airlines.',
      hook: 'Built the frontend behind **EasyJet** and **Singapore Airlines**\' booking experience.',
      decision: { kind: 'none' },
      work: [
        'Designed and built a white label frontend architecture serving multiple enterprise clients from a single platform.',
        'Led the design and implementation of cross payment flows across markets.',
        'Shipped the calendar and airplane seat selection features.',
      ],
      departure: { kind: 'undisclosed' },
    },
  },
] as const;

export const getCompanyEntries = (): ReadonlyArray<CompanyEntry> => CAREER_ROUTE;
