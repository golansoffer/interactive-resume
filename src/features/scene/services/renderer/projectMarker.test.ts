import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../types/company';
import type { RouteProjection } from '../../types/route-projection';
import { targetFor } from './projectMarker';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');

const PRE_ROUTE: RouteProjection = {
  kind: 'pre_route',
  firstTarget: { id: mave, placement: [0, 0, 70] },
};
const MID_ROUTE: RouteProjection = {
  kind: 'mid_route',
  anchor: { id: mave, placement: [0, 0, 70] },
  nextTarget: { id: eightfig, placement: [0, 0, 170] },
};
const COMPLETE: RouteProjection = {
  kind: 'complete',
  anchor: { id: mave, placement: [0, 0, 70] },
};

describe('projectMarker.targetFor — switch on projection.kind', () => {
  it('returns none for complete', () => {
    expect(targetFor(COMPLETE)).toEqual({ kind: 'none' });
  });

  it('returns target=firstTarget for pre_route', () => {
    expect(targetFor(PRE_ROUTE)).toEqual({
      kind: 'target',
      target: { id: mave, placement: [0, 0, 70] },
    });
  });

  it('returns target=nextTarget for mid_route', () => {
    expect(targetFor(MID_ROUTE)).toEqual({
      kind: 'target',
      target: { id: eightfig, placement: [0, 0, 170] },
    });
  });
});
