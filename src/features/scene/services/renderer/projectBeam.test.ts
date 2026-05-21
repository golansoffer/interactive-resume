import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../types/company';
import type { RouteProjection } from '../../types/route-projection';
import { cuesFor } from './projectBeam';

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

describe('projectBeam.cuesFor — switch on projection.kind', () => {
  it('returns silent for pre_route (no anchor yet, nothing to draw between)', () => {
    expect(cuesFor(PRE_ROUTE)).toEqual({ kind: 'silent' });
  });

  it('returns silent for complete (tour over, no nextTarget)', () => {
    expect(cuesFor(COMPLETE)).toEqual({ kind: 'silent' });
  });

  it('returns visible with anchor and nextTarget placements as start and end for mid_route', () => {
    expect(cuesFor(MID_ROUTE)).toEqual({
      kind: 'visible',
      start: [0, 0, 70],
      end: [0, 0, 170],
    });
  });
});
