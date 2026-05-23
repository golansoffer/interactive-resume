import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asCompanyId, type CompanyEntry, type CompanyId } from '../../../scene/types/company';
import type { PlanetAssetId } from '../../../scene/types/planet';
import type { SceneState } from '../../../scene/types/scene-state';
import { asShortCode } from '../../../scene/types/short-code';
import { useProgress } from './useProgress';

vi.mock('../../../comms/services/prefersReducedMotion', () => ({
  subscribePrefersReducedMotion: (cb: (p: { kind: 'normal' | 'reduced' }) => void) => {
    cb({ kind: 'normal' });
    return (): void => {};
  },
}));

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
  planet: { assetId, placement: placement(z), satellites: [] },
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

describe('useProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a well-formed projection on first render', () => {
    const state: SceneState = { kind: 'playing' };
    const { result } = renderHook(() => useProgress({ state, visited: [], route: ROUTE }));
    expect(result.current.projection.headline.kind).toBe('empty');
    expect(result.current.projection.counter).toEqual({ kind: 'idle', visited: 0, total: 5 });
    expect(result.current.visitEvent).toBeNull();
  });

  it('exposes a visit event after a transition to revealing a new planet', () => {
    const { rerender, result } = renderHook(
      (props: { state: SceneState; visited: ReadonlyArray<CompanyId> }) =>
        useProgress({ state: props.state, visited: props.visited, route: ROUTE }),
      {
        initialProps: {
          state: { kind: 'playing' } as SceneState,
          visited: [] as ReadonlyArray<CompanyId>,
        },
      },
    );

    // sceneMachine updates `state` and `visited` atomically via XState's
    // assign — once `revealing(mave)` fires, visited already contains mave.
    rerender({
      state: { kind: 'revealing', objectId: mave } as SceneState,
      visited: [mave],
    });

    expect(result.current.visitEvent).toEqual({
      kind: 'first_visit',
      companyId: mave,
      assetId: 'saturn_b',
    });
  });

  it('clears the visit event after the regular-visit window elapses', () => {
    const { rerender, result } = renderHook(
      (props: { state: SceneState; visited: ReadonlyArray<CompanyId> }) =>
        useProgress({ state: props.state, visited: props.visited, route: ROUTE }),
      {
        initialProps: {
          state: { kind: 'playing' } as SceneState,
          visited: [] as ReadonlyArray<CompanyId>,
        },
      },
    );

    rerender({
      state: { kind: 'revealing', objectId: mave } as SceneState,
      visited: [mave],
    });
    expect(result.current.visitEvent).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.visitEvent).toBeNull();
  });

  it('clears the visit event after the route-complete window (1500ms)', () => {
    const { rerender, result } = renderHook(
      (props: { state: SceneState; visited: ReadonlyArray<CompanyId> }) =>
        useProgress({ state: props.state, visited: props.visited, route: ROUTE }),
      {
        initialProps: {
          state: { kind: 'revealing', objectId: streamelements } as SceneState,
          visited: [mave, eightfig, riverside, streamelements],
        },
      },
    );

    rerender({
      state: { kind: 'revealing', objectId: tgs } as SceneState,
      visited: [mave, eightfig, riverside, streamelements, tgs],
    });
    expect(result.current.visitEvent?.kind).toBe('route_complete');

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.visitEvent).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.visitEvent).toBeNull();
  });

  it('exposes visibility based on scene state', () => {
    const { result, rerender } = renderHook(
      (props: { state: SceneState }) =>
        useProgress({ state: props.state, visited: [], route: ROUTE }),
      { initialProps: { state: { kind: 'loading' } as SceneState } },
    );
    expect(result.current.visibility).toEqual({ kind: 'hidden' });

    rerender({ state: { kind: 'playing' } as SceneState });
    expect(result.current.visibility).toEqual({ kind: 'visible' });
  });

  it('exposes motion preference', () => {
    const { result } = renderHook(() =>
      useProgress({ state: { kind: 'playing' } as SceneState, visited: [], route: ROUTE }),
    );
    expect(result.current.motion).toEqual({ kind: 'normal' });
  });
});
