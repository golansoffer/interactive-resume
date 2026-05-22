import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../../scene/types/company';
import type { Pip } from '../../types/pip';
import type { PipTuple } from '../../types/progress-projection';
import type { ProgressProjection } from '../../types/progress-projection';
import { detectVisitEvents } from './detectVisitEvents';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

const u = (id: typeof mave, asset: 'saturn_b' | 'jupiter_b' | 'mars_b' | 'earth_b' | 'venus_b'): Pip => ({
  kind: 'unvisited',
  companyId: id,
  assetId: asset,
});
const v = (id: typeof mave, asset: 'saturn_b' | 'jupiter_b' | 'mars_b' | 'earth_b' | 'venus_b'): Pip => ({
  kind: 'visited',
  companyId: id,
  assetId: asset,
});
const h = (id: typeof mave, asset: 'saturn_b' | 'jupiter_b' | 'mars_b' | 'earth_b' | 'venus_b'): Pip => ({
  kind: 'here',
  companyId: id,
  assetId: asset,
});

const tuple = (a: Pip, b: Pip, c: Pip, d: Pip, e: Pip): PipTuple => [a, b, c, d, e];

const makeProjection = (
  pips: PipTuple,
  visited: number,
  isComplete: boolean,
): ProgressProjection => ({
  headline: { kind: 'empty' },
  status: { kind: 'standby' },
  counter: isComplete ? { kind: 'complete', total: 5 } : { kind: 'idle', visited, total: 5 },
  pips,
});

describe('detectVisitEvents', () => {
  it('returns null when projections are identical', () => {
    const projection = makeProjection(
      tuple(
        u(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      0,
      false,
    );
    expect(detectVisitEvents(projection, projection)).toBeNull();
  });

  it('returns first_visit when a pip went unvisited → here', () => {
    const prev = makeProjection(
      tuple(
        u(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      0,
      false,
    );
    const next = makeProjection(
      tuple(
        h(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      0,
      false,
    );
    expect(detectVisitEvents(prev, next)).toEqual({
      kind: 'first_visit',
      companyId: mave,
      assetId: 'saturn_b',
    });
  });

  it('returns route_complete when the 5th pip becomes here and counter completes', () => {
    const prev = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        v(eightfig, 'jupiter_b'),
        v(riverside, 'mars_b'),
        v(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      4,
      false,
    );
    const next = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        v(eightfig, 'jupiter_b'),
        v(riverside, 'mars_b'),
        v(streamelements, 'earth_b'),
        h(tgs, 'venus_b'),
      ),
      4,
      true,
    );
    expect(detectVisitEvents(prev, next)).toEqual({
      kind: 'route_complete',
      companyId: tgs,
      assetId: 'venus_b',
    });
  });

  it('returns revisit when a pip went visited → here', () => {
    const prev = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    const next = makeProjection(
      tuple(
        h(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    expect(detectVisitEvents(prev, next)).toEqual({
      kind: 'revisit',
      companyId: mave,
      assetId: 'saturn_b',
    });
  });

  it('returns depart when a pip went here → visited', () => {
    const prev = makeProjection(
      tuple(
        h(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    const next = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    expect(detectVisitEvents(prev, next)).toEqual({
      kind: 'depart',
      companyId: mave,
      assetId: 'saturn_b',
    });
  });

  it('returns first_visit for the new pip when proximity moves from one planet to a fresh one in one tick', () => {
    const prev = makeProjection(
      tuple(
        h(mave, 'saturn_b'),
        u(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    const next = makeProjection(
      tuple(
        v(mave, 'saturn_b'),
        h(eightfig, 'jupiter_b'),
        u(riverside, 'mars_b'),
        u(streamelements, 'earth_b'),
        u(tgs, 'venus_b'),
      ),
      1,
      false,
    );
    const event = detectVisitEvents(prev, next);
    expect(event).toEqual({
      kind: 'first_visit',
      companyId: eightfig,
      assetId: 'jupiter_b',
    });
  });
});
