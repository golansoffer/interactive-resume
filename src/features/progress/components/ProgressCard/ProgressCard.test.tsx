import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

afterEach(cleanup);
import type { JSX } from 'react';
import { asCompanyId } from '../../../scene/types/company';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import { asShortCode } from '../../../scene/types/short-code';
import type { ProgressProjection } from '../../types/progress-projection';
import type { ProgressVisibility } from '../../types/progress-visibility';
import type { VisitEvent } from '../../types/visit-event';
import { ProgressCard } from './ProgressCard';

// Stub PlanetCanvas across all sub-components to avoid R3F in jsdom.
vi.mock('./PlanetCanvas', () => ({
  PlanetCanvas: ({
    assetId,
    rotates,
  }: {
    readonly assetId: string;
    readonly rotates: boolean;
  }): JSX.Element => (
    <div data-asset={assetId} data-rotates={String(rotates)}>
      mock-planet-canvas
    </div>
  ),
}));

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

const motion = (kind: MotionPreference['kind']): MotionPreference => ({ kind });
const visible: ProgressVisibility = { kind: 'visible' };
const hidden: ProgressVisibility = { kind: 'hidden' };

const preRouteProjection: ProgressProjection = {
  headline: { kind: 'empty' },
  status: { kind: 'standby' },
  counter: { kind: 'idle', visited: 0, total: 5 },
  pips: [
    { kind: 'unvisited', companyId: mave, assetId: 'saturn_b' },
    { kind: 'unvisited', companyId: eightfig, assetId: 'jupiter_b' },
    { kind: 'unvisited', companyId: riverside, assetId: 'mars_b' },
    { kind: 'unvisited', companyId: streamelements, assetId: 'earth_b' },
    { kind: 'unvisited', companyId: tgs, assetId: 'venus_b' },
  ],
};

const midRouteProjection: ProgressProjection = {
  headline: {
    kind: 'active',
    company: { id: riverside, assetId: 'mars_b', shortCode: asShortCode('RVS') },
  },
  status: { kind: 'active' },
  counter: { kind: 'idle', visited: 3, total: 5 },
  pips: [
    { kind: 'visited', companyId: mave, assetId: 'saturn_b' },
    { kind: 'visited', companyId: eightfig, assetId: 'jupiter_b' },
    { kind: 'here', companyId: riverside, assetId: 'mars_b' },
    { kind: 'unvisited', companyId: streamelements, assetId: 'earth_b' },
    { kind: 'unvisited', companyId: tgs, assetId: 'venus_b' },
  ],
};

describe('ProgressCard', () => {
  it('returns null when visibility is hidden', () => {
    const { container } = render(
      <ProgressCard
        projection={preRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={hidden}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the card when visibility is visible', () => {
    const { container } = render(
      <ProgressCard
        projection={preRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    expect(container.querySelector('[data-progress-card]')).not.toBeNull();
  });

  it('renders 5 pip elements in canonical career order (companyIds)', () => {
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const pips = Array.from(container.querySelectorAll<HTMLElement>('[data-pip]'));
    expect(pips.length).toBe(5);
    const [pip0, pip1, pip2, pip3, pip4] = pips;
    expect(pip0?.dataset['company']).toBe(mave);
    expect(pip1?.dataset['company']).toBe(eightfig);
    expect(pip2?.dataset['company']).toBe(riverside);
    expect(pip3?.dataset['company']).toBe(streamelements);
    expect(pip4?.dataset['company']).toBe(tgs);
  });

  it('renders the headline short code text when headline is not empty', () => {
    render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    expect(screen.getByText('RVS')).toBeTruthy();
  });

  it('renders em-dash when headline is empty', () => {
    render(
      <ProgressCard
        projection={preRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('applies data-burst="active" to the card when a first_visit event is present', () => {
    const visitEvent: VisitEvent = {
      kind: 'first_visit',
      companyId: riverside,
      assetId: 'mars_b',
    };
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={visitEvent}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const card = container.querySelector<HTMLElement>('[data-progress-card]');
    expect(card?.dataset['burst']).toBe('active');
  });

  it('applies data-burst="active" to the card when a route_complete event is present', () => {
    const visitEvent: VisitEvent = {
      kind: 'route_complete',
      companyId: tgs,
      assetId: 'venus_b',
    };
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={visitEvent}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const card = container.querySelector<HTMLElement>('[data-progress-card]');
    expect(card?.dataset['burst']).toBe('active');
  });

  it('applies isBursting only to the matching pip, not the others', () => {
    const visitEvent: VisitEvent = {
      kind: 'first_visit',
      companyId: riverside,
      assetId: 'mars_b',
    };
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={visitEvent}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const matchedPip = container.querySelector<HTMLElement>(
      `[data-pip][data-company="${riverside}"]`,
    );
    expect(matchedPip?.dataset['burst']).toBe('active');

    const otherPip = container.querySelector<HTMLElement>(
      `[data-pip][data-company="${mave}"]`,
    );
    expect(otherPip?.dataset['burst']).toBe('idle');
  });

  it('does NOT apply isBursting to any pip on a revisit event (revisits do not ripple)', () => {
    const visitEvent: VisitEvent = {
      kind: 'revisit',
      companyId: mave,
      assetId: 'saturn_b',
    };
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={visitEvent}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const allPips = container.querySelectorAll<HTMLElement>('[data-pip]');
    for (const pip of allPips) {
      expect(pip.dataset['burst']).toBe('idle');
    }
  });

  it('exposes aria-label on the card root', () => {
    const { container } = render(
      <ProgressCard
        projection={midRouteProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const card = container.querySelector('[data-progress-card]');
    expect(card?.getAttribute('aria-label')).toBe('Exploration progress');
    // NOTE: aria-label is NOT data-* so dataset doesn't apply.
  });

  it('exposes data-state="complete" when counter is complete', () => {
    // querySelector<HTMLElement> so .dataset typechecks on the result.
    const completeProjection: ProgressProjection = {
      ...midRouteProjection,
      headline: {
        kind: 'complete',
        company: { id: tgs, assetId: 'venus_b', shortCode: asShortCode('TGS') },
      },
      status: { kind: 'route_complete' },
      counter: { kind: 'complete', total: 5 },
      pips: [
        { kind: 'visited', companyId: mave, assetId: 'saturn_b' },
        { kind: 'visited', companyId: eightfig, assetId: 'jupiter_b' },
        { kind: 'visited', companyId: riverside, assetId: 'mars_b' },
        { kind: 'visited', companyId: streamelements, assetId: 'earth_b' },
        { kind: 'visited', companyId: tgs, assetId: 'venus_b' },
      ],
    };
    const { container } = render(
      <ProgressCard
        projection={completeProjection}
        visitEvent={null}
        motion={motion('normal')}
        visibility={visible}
      />,
    );
    const card = container.querySelector<HTMLElement>('[data-progress-card]');
    expect(card?.dataset['state']).toBe('complete');
  });
});
