import { describe, expect, it } from 'vitest';
import { asCompanyId, type CompanyEntry } from '../../types/company';
import { asShortCode } from '../../types/short-code';
import { projectRoute } from './projectRoute';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

const placement = (z: number): readonly [number, number, number] => [0, 0, z];

const entryFor = (id: CompanyEntry['id'], z: number): CompanyEntry => ({
  id,
  shortCode: asShortCode('XYZ'),
  planet: { assetId: 'mars_b', placement: placement(z), satellites: [] },
  info: {
    companyName: 'X',
    logo: { kind: 'no_icon' },
    website: { kind: 'no_website' },
    role: 'X',
    period: { kind: 'ongoing', start: { year: 2020, month: 1 } },
    oneLiner: 'X',
    hook: 'X',
    decision: { kind: 'none' },
    work: ['X'],
    departure: { kind: 'current_role' },
  },
});

const CAREER_ROUTE: readonly [
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
] = [
  entryFor(mave, 70),
  entryFor(eightfig, 170),
  entryFor(riverside, 250),
  entryFor(streamelements, 325),
  entryFor(tgs, 395),
];

describe('projectRoute', () => {
  it('returns pre_route with firstTarget=Mave when visited is empty', () => {
    const projection = projectRoute([], CAREER_ROUTE);
    expect(projection).toEqual({
      kind: 'pre_route',
      firstTarget: { id: mave, placement: placement(70) },
    });
  });

  it('returns mid_route with anchor=Mave, nextTarget=8fig when only Mave is visited', () => {
    const projection = projectRoute([mave], CAREER_ROUTE);
    expect(projection).toEqual({
      kind: 'mid_route',
      anchor: { id: mave, placement: placement(70) },
      nextTarget: { id: eightfig, placement: placement(170) },
    });
  });

  it('returns mid_route with anchor=StreamElements, nextTarget=Mave when Earth was visited first (out-of-order)', () => {
    const projection = projectRoute([streamelements], CAREER_ROUTE);
    expect(projection).toEqual({
      kind: 'mid_route',
      anchor: { id: streamelements, placement: placement(325) },
      nextTarget: { id: mave, placement: placement(70) },
    });
  });

  it('returns mid_route with anchor=last-visited regardless of route position (re-visit move-to-end)', () => {
    const projection = projectRoute([mave, eightfig, mave], CAREER_ROUTE);
    expect(projection.kind).toBe('mid_route');
    if (projection.kind !== 'mid_route') throw new Error('expected mid_route');
    expect(projection.anchor.id).toBe(mave);
    expect(projection.nextTarget.id).toBe(riverside);
  });

  it('returns complete with anchor=last-visited when all five are visited (any order)', () => {
    const projection = projectRoute(
      [tgs, streamelements, riverside, eightfig, mave],
      CAREER_ROUTE,
    );
    expect(projection).toEqual({
      kind: 'complete',
      anchor: { id: mave, placement: placement(70) },
    });
  });
});
