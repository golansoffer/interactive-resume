import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SHIP_IDS } from '../../types/ship';
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
