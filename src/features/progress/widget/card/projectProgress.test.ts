import { describe, expect, it } from 'vitest';
import { asCompanyId, type CompanyEntry } from '../../../scene/types/company';
import type { PlanetAssetId } from '../../../scene/types/planet';
import type { SceneState } from '../../../scene/types/scene-state';
import { asShortCode } from '../../../scene/types/short-code';
import { projectProgress } from './projectProgress';

const mave = asCompanyId('mave');
const eightfig = asCompanyId('8fig');
const riverside = asCompanyId('riverside');
const streamelements = asCompanyId('streamelements');
const tgs = asCompanyId('tgs');

const placement = (z: number): readonly [number, number, number] => [0, 0, z];

const entryFor = (
  id: CompanyEntry['id'],
  code: string,
  assetId: PlanetAssetId,
  z: number,
): CompanyEntry => ({
  id,
  shortCode: asShortCode(code),
  planet: { assetId, placement: placement(z) },
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

const ROUTE: readonly [
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
  CompanyEntry,
] = [
  entryFor(mave, 'MAV', 'saturn_b', 70),
  entryFor(eightfig, '8FG', 'jupiter_b', 170),
  entryFor(riverside, 'RVS', 'mars_b', 250),
  entryFor(streamelements, 'STE', 'earth_b', 325),
  entryFor(tgs, 'TGS', 'venus_b', 395),
];

describe('projectProgress', () => {
  it('returns empty headline + standby + idle 0/5 + all unvisited when nothing visited and scene playing', () => {
    const state: SceneState = { kind: 'playing' };
    const projection = projectProgress(state, [], ROUTE);

    expect(projection.headline).toEqual({ kind: 'empty' });
    expect(projection.status).toEqual({ kind: 'standby' });
    expect(projection.counter).toEqual({ kind: 'idle', visited: 0, total: 5 });
    expect(projection.pips.every((p) => p.kind === 'unvisited')).toBe(true);
  });

  it('returns anchor headline + last_explored + idle 1/5 with one visited (free-roaming)', () => {
    const state: SceneState = { kind: 'playing' };
    const projection = projectProgress(state, [mave], ROUTE);

    expect(projection.headline).toEqual({
      kind: 'anchor',
      company: { id: mave, assetId: 'saturn_b', shortCode: asShortCode('MAV') },
    });
    expect(projection.status).toEqual({ kind: 'last_explored' });
    expect(projection.counter).toEqual({ kind: 'idle', visited: 1, total: 5 });
    expect(projection.pips[0].kind).toBe('visited');
    expect(projection.pips[1].kind).toBe('unvisited');
  });

  it('anchor headline is the last-visited (not the most-recent-route) — out-of-order visits', () => {
    const state: SceneState = { kind: 'playing' };
    const projection = projectProgress(state, [mave, streamelements], ROUTE);

    expect(projection.headline.kind).toBe('anchor');
    if (projection.headline.kind !== 'anchor') throw new Error('expected anchor');
    expect(projection.headline.company.id).toBe(streamelements);
    expect(projection.counter).toEqual({ kind: 'idle', visited: 2, total: 5 });
    expect(projection.pips[0].kind).toBe('visited');
    expect(projection.pips[3].kind).toBe('visited');
    expect(projection.pips[1].kind).toBe('unvisited');
  });

  it('returns active headline + active + idle when revealing a planet not yet in visited', () => {
    const state: SceneState = { kind: 'revealing', objectId: riverside };
    const projection = projectProgress(state, [mave], ROUTE);

    expect(projection.headline).toEqual({
      kind: 'active',
      company: { id: riverside, assetId: 'mars_b', shortCode: asShortCode('RVS') },
    });
    expect(projection.status).toEqual({ kind: 'active' });
    expect(projection.counter).toEqual({ kind: 'idle', visited: 1, total: 5 });
    expect(projection.pips[0].kind).toBe('visited');
    expect(projection.pips[2].kind).toBe('here');
  });

  it('returns active headline + active when re-revealing an already-visited planet (revisit)', () => {
    const state: SceneState = { kind: 'revealing', objectId: mave };
    const projection = projectProgress(state, [mave, eightfig, mave], ROUTE);

    expect(projection.headline.kind).toBe('active');
    if (projection.headline.kind !== 'active') throw new Error('expected active');
    expect(projection.headline.company.id).toBe(mave);
    expect(projection.pips[0].kind).toBe('here');
    expect(projection.pips[1].kind).toBe('visited');
  });

  it('returns complete headline + route_complete + complete counter when all 5 visited and playing', () => {
    const state: SceneState = { kind: 'playing' };
    const projection = projectProgress(
      state,
      [mave, eightfig, riverside, streamelements, tgs],
      ROUTE,
    );

    expect(projection.headline.kind).toBe('complete');
    if (projection.headline.kind !== 'complete') throw new Error('expected complete');
    expect(projection.headline.company.id).toBe(tgs);
    expect(projection.status).toEqual({ kind: 'route_complete' });
    expect(projection.counter).toEqual({ kind: 'complete', total: 5 });
    expect(projection.pips.every((p) => p.kind === 'visited')).toBe(true);
  });

  it('counter stays "complete" even when re-revealing after route completion (active overlay layered)', () => {
    const state: SceneState = { kind: 'revealing', objectId: riverside };
    const projection = projectProgress(
      state,
      [mave, eightfig, riverside, streamelements, tgs, riverside],
      ROUTE,
    );

    expect(projection.counter).toEqual({ kind: 'complete', total: 5 });
    expect(projection.status).toEqual({ kind: 'active' });
    expect(projection.headline.kind).toBe('active');
  });

  it('paused-resume-to-playing projects the same shape as playing with same visited', () => {
    const state: SceneState = { kind: 'paused', resumeTo: { kind: 'playing' } };
    const projection = projectProgress(state, [mave, eightfig], ROUTE);

    expect(projection.headline.kind).toBe('anchor');
    if (projection.headline.kind !== 'anchor') throw new Error('expected anchor');
    expect(projection.headline.company.id).toBe(eightfig);
    expect(projection.status).toEqual({ kind: 'last_explored' });
  });

  it('paused-resume-to-revealing projects the same shape as revealing with same visited', () => {
    const state: SceneState = {
      kind: 'paused',
      resumeTo: { kind: 'revealing', objectId: tgs },
    };
    const projection = projectProgress(state, [mave], ROUTE);

    expect(projection.headline.kind).toBe('active');
    if (projection.headline.kind !== 'active') throw new Error('expected active');
    expect(projection.headline.company.id).toBe(tgs);
    expect(projection.status).toEqual({ kind: 'active' });
    expect(projection.pips[4].kind).toBe('here');
  });

  it('loading state still returns a well-formed projection (caller handles visibility)', () => {
    const state: SceneState = { kind: 'loading' };
    const projection = projectProgress(state, [], ROUTE);

    expect(projection.headline).toEqual({ kind: 'empty' });
    expect(projection.status).toEqual({ kind: 'standby' });
    expect(projection.counter).toEqual({ kind: 'idle', visited: 0, total: 5 });
  });

  it('pips are always returned in canonical career order regardless of visit order', () => {
    const state: SceneState = { kind: 'playing' };
    // out-of-order visits
    const visited = [tgs, streamelements, mave];
    const projection = projectProgress(state, visited, ROUTE);

    expect(projection.pips[0].companyId).toBe(mave);
    expect(projection.pips[1].companyId).toBe(eightfig);
    expect(projection.pips[2].companyId).toBe(riverside);
    expect(projection.pips[3].companyId).toBe(streamelements);
    expect(projection.pips[4].companyId).toBe(tgs);
  });
});
