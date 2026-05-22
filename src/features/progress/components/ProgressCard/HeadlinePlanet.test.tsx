import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { JSX } from 'react';
import { asCompanyId } from '../../../scene/types/company';
import { asShortCode } from '../../../scene/types/short-code';
import type { Headline } from '../../types/headline';
import { HeadlinePlanet } from './HeadlinePlanet';

// PlanetCanvas pulls in R3F + GLTF assets, neither of which load in jsdom.
// Stub it out so the wrapper renders predictably.
vi.mock('./PlanetCanvas', () => ({
  PlanetCanvas: ({ assetId }: { readonly assetId: string }): JSX.Element => (
    <div data-asset={assetId}>mock-planet-canvas</div>
  ),
}));

describe('HeadlinePlanet', () => {
  it('renders the empty placeholder when headline kind is empty', () => {
    const headline: Headline = { kind: 'empty' };
    const { container } = render(<HeadlinePlanet headline={headline} />);
    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();
    expect(container.querySelector('[data-asset]')).toBeNull();
  });

  it('renders a PlanetCanvas with the company asset when headline kind is active', () => {
    const headline: Headline = {
      kind: 'active',
      company: {
        id: asCompanyId('riverside'),
        assetId: 'mars_b',
        shortCode: asShortCode('RVS'),
      },
    };
    const { container } = render(<HeadlinePlanet headline={headline} />);
    expect(container.querySelector('[data-state="active"]')).not.toBeNull();
    expect(container.querySelector('[data-asset="mars_b"]')).not.toBeNull();
  });

  it('renders with data-state="anchor" for anchor headline', () => {
    const headline: Headline = {
      kind: 'anchor',
      company: {
        id: asCompanyId('mave'),
        assetId: 'saturn_b',
        shortCode: asShortCode('MAV'),
      },
    };
    const { container } = render(<HeadlinePlanet headline={headline} />);
    expect(container.querySelector('[data-state="anchor"]')).not.toBeNull();
  });

  it('renders with data-state="complete" for complete headline', () => {
    const headline: Headline = {
      kind: 'complete',
      company: {
        id: asCompanyId('tgs'),
        assetId: 'venus_b',
        shortCode: asShortCode('TGS'),
      },
    };
    const { container } = render(<HeadlinePlanet headline={headline} />);
    expect(container.querySelector('[data-state="complete"]')).not.toBeNull();
  });
});
