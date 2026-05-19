import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_TRANSITION_MS } from '../../components/ShipSelector/tickRotation';
import { DEFAULT_SHIP_ID, SHIP_IDS } from '../../types/ship';
import { useShipSelector } from './useShipSelector';

describe('useShipSelector', () => {
  it('starts with hover.kind === none and 8 ships in SHIP_IDS order', () => {
    const { result } = renderHook(() => useShipSelector());
    expect(result.current.hover.kind).toBe('none');
    expect(result.current.ships.map((s) => s.id)).toEqual([...SHIP_IDS]);
  });

  it('onHoverEnter(id) updates hover state', () => {
    const { result } = renderHook(() => useShipSelector());
    act(() => { result.current.onHoverEnter('speederA'); });
    expect(result.current.hover).toEqual({ kind: 'hovering', id: 'speederA' });
  });

  it('onHoverEnter replaces the previous hover', () => {
    const { result } = renderHook(() => useShipSelector());
    act(() => { result.current.onHoverEnter('speederA'); });
    act(() => { result.current.onHoverEnter('cargoB'); });
    expect(result.current.hover).toEqual({ kind: 'hovering', id: 'cargoB' });
  });

  it('onHoverLeave clears hover state', () => {
    const { result } = renderHook(() => useShipSelector());
    act(() => { result.current.onHoverEnter('racer'); });
    act(() => { result.current.onHoverLeave(); });
    expect(result.current.hover).toEqual({ kind: 'none' });
  });

  it('preserves callback identity across re-renders', () => {
    const { result, rerender } = renderHook(() => useShipSelector());
    const enterBefore = result.current.onHoverEnter;
    const leaveBefore = result.current.onHoverLeave;
    rerender();
    expect(result.current.onHoverEnter).toBe(enterBefore);
    expect(result.current.onHoverLeave).toBe(leaveBefore);
  });
});

describe('useShipSelector — heroPhase transition machine', () => {
  beforeEach(() => {
    // toFake includes performance so performance.now() advances with the
    // fake clock — the hook records startedAt = performance.now().
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial heroPhase is stable on the DEFAULT_SHIP', () => {
    const { result } = renderHook(() => useShipSelector());
    expect(result.current.heroPhase.kind).toBe('stable');
    if (result.current.heroPhase.kind !== 'stable') return;
    expect(result.current.heroPhase.current.id).toBe(DEFAULT_SHIP_ID);
  });

  it('hovering a non-default ship enters transitioning with outgoing=default, incoming=hovered', () => {
    const { result } = renderHook(() => useShipSelector());
    act(() => { result.current.onHoverEnter('cargoA'); });
    expect(result.current.heroPhase.kind).toBe('transitioning');
    if (result.current.heroPhase.kind !== 'transitioning') return;
    expect(result.current.heroPhase.outgoing.id).toBe(DEFAULT_SHIP_ID);
    expect(result.current.heroPhase.incoming.id).toBe('cargoA');
    expect(Number.isFinite(result.current.heroPhase.startedAt)).toBe(true);
  });

  it('lands on stable=incoming after HERO_TRANSITION_MS', () => {
    const { result } = renderHook(() => useShipSelector());
    act(() => { result.current.onHoverEnter('cargoA'); });
    act(() => { vi.advanceTimersByTime(HERO_TRANSITION_MS); });
    expect(result.current.heroPhase.kind).toBe('stable');
    if (result.current.heroPhase.kind !== 'stable') return;
    expect(result.current.heroPhase.current.id).toBe('cargoA');
  });

  it('hovering the currently-visible ship does not start a transition', () => {
    const { result } = renderHook(() => useShipSelector());
    act(() => { result.current.onHoverEnter(DEFAULT_SHIP_ID); });
    expect(result.current.heroPhase.kind).toBe('stable');
  });

  it('mid-transition hover restarts: outgoing becomes the prev incoming, incoming becomes the new target', () => {
    const { result } = renderHook(() => useShipSelector());
    act(() => { result.current.onHoverEnter('cargoA'); });
    act(() => { vi.advanceTimersByTime(HERO_TRANSITION_MS / 2); });
    expect(result.current.heroPhase.kind).toBe('transitioning');
    act(() => { result.current.onHoverEnter('racer'); });
    expect(result.current.heroPhase.kind).toBe('transitioning');
    if (result.current.heroPhase.kind !== 'transitioning') return;
    expect(result.current.heroPhase.outgoing.id).toBe('cargoA');
    expect(result.current.heroPhase.incoming.id).toBe('racer');
  });

  it('mid-transition interruption clears the previous timer (no early-landing race)', () => {
    const { result } = renderHook(() => useShipSelector());
    // t = 0 from the hook's POV — first hover starts the cargoA transition.
    act(() => { result.current.onHoverEnter('cargoA'); });
    // Advance to t = HERO_TRANSITION_MS / 2: mid-flight; cargoA timer scheduled
    // to fire at t = HERO_TRANSITION_MS.
    act(() => { vi.advanceTimersByTime(HERO_TRANSITION_MS / 2); });
    // Interrupt: new hover starts a racer transition with a fresh timer at
    // t = HERO_TRANSITION_MS / 2 + HERO_TRANSITION_MS = 1.5 * HERO_TRANSITION_MS.
    act(() => { result.current.onHoverEnter('racer'); });
    // Advance past the (now-cleared) cargoA timer's would-be landing at t = HERO_TRANSITION_MS.
    // We're now at t = HERO_TRANSITION_MS / 2 + HERO_TRANSITION_MS / 2 + 1 = HERO_TRANSITION_MS + 1.
    act(() => { vi.advanceTimersByTime(HERO_TRANSITION_MS / 2 + 1); });
    // If the cleanup had failed, the cargoA timer would have fired at t = HERO_TRANSITION_MS
    // and landed us on stable=cargoA. Instead we expect to still be mid-flight to racer.
    const midPhase = result.current.heroPhase;
    expect(midPhase.kind).toBe('transitioning');
    if (midPhase.kind !== 'transitioning') return;
    expect(midPhase.incoming.id).toBe('racer');
    // Reach the racer timer's landing at t = 1.5 * HERO_TRANSITION_MS.
    act(() => { vi.advanceTimersByTime(HERO_TRANSITION_MS / 2); });
    const landedPhase = result.current.heroPhase;
    expect(landedPhase.kind).toBe('stable');
    if (landedPhase.kind !== 'stable') return;
    expect(landedPhase.current.id).toBe('racer');
  });

  it('three quick hovers land on the last one after HERO_TRANSITION_MS from the last hover', () => {
    const { result } = renderHook(() => useShipSelector());
    act(() => { result.current.onHoverEnter('speederB'); });
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { result.current.onHoverEnter('cargoB'); });
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { result.current.onHoverEnter('racer'); });
    act(() => { vi.advanceTimersByTime(HERO_TRANSITION_MS); });
    expect(result.current.heroPhase.kind).toBe('stable');
    if (result.current.heroPhase.kind !== 'stable') return;
    expect(result.current.heroPhase.current.id).toBe('racer');
  });

  it('onHoverLeave returns toward DEFAULT_SHIP via a transition', () => {
    const { result } = renderHook(() => useShipSelector());
    act(() => { result.current.onHoverEnter('cargoA'); });
    act(() => { vi.advanceTimersByTime(HERO_TRANSITION_MS); });
    act(() => { result.current.onHoverLeave(); });
    const leavingPhase = result.current.heroPhase;
    expect(leavingPhase.kind).toBe('transitioning');
    if (leavingPhase.kind !== 'transitioning') return;
    expect(leavingPhase.outgoing.id).toBe('cargoA');
    expect(leavingPhase.incoming.id).toBe(DEFAULT_SHIP_ID);
    act(() => { vi.advanceTimersByTime(HERO_TRANSITION_MS); });
    const restedPhase = result.current.heroPhase;
    expect(restedPhase.kind).toBe('stable');
    if (restedPhase.kind !== 'stable') return;
    expect(restedPhase.current.id).toBe(DEFAULT_SHIP_ID);
  });
});
