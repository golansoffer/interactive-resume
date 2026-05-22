import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCommsDock } from './useCommsDock';
import { createHarness, createKinematicsRef, sample } from './useCommsDockTestHarness';
import { asCompanyId } from '../../../scene/types/company';
import { MAX_SPEED } from '../../../scene/types/kinematics';
import type { SceneState } from '../../../scene/types/scene-state';

const BOOST_TOP_SPEED = MAX_SPEED * 3;
const HALF_BOOST_SPEED = BOOST_TOP_SPEED / 2;

const playing: SceneState = { kind: 'playing' };
const loading: SceneState = { kind: 'loading' };
const revealing: SceneState = { kind: 'revealing', objectId: asCompanyId('acme') };
const paused: SceneState = { kind: 'paused', resumeTo: { kind: 'playing' } };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCommsDock — velocity readout wiring', () => {
  it('initial state.readout has metersPerSecond 0 and ratio 0 (parsed Readout, not raw Kinematics)', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    expect(result.current.readout.kind).toBe('readout');
    expect(result.current.readout.metersPerSecond).toBe(0);
    expect(result.current.readout.ratio).toBe(0);
  });

  it('state.readout updates when the kinematics port pushes a new sample', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      h.kinematics.push(sample(HALF_BOOST_SPEED, 0));
    });
    expect(result.current.readout.metersPerSecond).toBeCloseTo(HALF_BOOST_SPEED);
    // Denominator is MAX_SPEED * 3 (full cruise-to-boost range); half of that = 0.5.
    expect(result.current.readout.ratio).toBeCloseTo(0.5);
  });

  it('exposes ratio 0 when the subscribed sample has velocity magnitude 0', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      h.kinematics.push(sample(0, 0));
    });
    expect(result.current.readout.ratio).toBe(0);
    expect(result.current.readout.metersPerSecond).toBe(0);
  });

  it('exposes ratio 1 when the subscribed sample has velocity magnitude at boost top speed', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      h.kinematics.push(sample(BOOST_TOP_SPEED, 0));
    });
    expect(result.current.readout.ratio).toBe(1);
    expect(result.current.readout.metersPerSecond).toBeCloseTo(BOOST_TOP_SPEED);
  });

  it('state.readout exposes only parsed Readout values (never raw Kinematics fields)', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      h.kinematics.push(sample(3, 4));
    });
    const readout = result.current.readout;
    expect(readout.kind).toBe('readout');
    expect(new Set(Object.keys(readout))).toEqual(new Set(['kind', 'metersPerSecond', 'ratio']));
    expect(Object.keys(readout)).toHaveLength(3);
  });
});

describe('useCommsDock — visibility wiring', () => {
  it('state.visibility is kind "visible" when the scene state is "playing"', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    expect(result.current.visibility).toEqual({ kind: 'visible' });
  });

  it('state.visibility is kind "visible" when the scene state is "revealing"', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: revealing, deps: h.deps }),
    );
    expect(result.current.visibility).toEqual({ kind: 'visible' });
  });

  it('state.visibility is kind "visible" when the scene state is "paused"', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: paused, deps: h.deps }),
    );
    expect(result.current.visibility).toEqual({ kind: 'visible' });
  });

  it('state.visibility is kind "hidden" when the scene state is "loading"', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: loading, deps: h.deps }),
    );
    expect(result.current.visibility).toEqual({ kind: 'hidden' });
  });
});
