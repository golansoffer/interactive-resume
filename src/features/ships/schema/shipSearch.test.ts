import { describe, expect, it } from 'vitest';
import { SHIP_IDS } from '../types/ship';
import { parseShipSearch } from './shipSearch';

describe('parseShipSearch', () => {
  it('accepts every SHIP_ID', () => {
    for (const id of SHIP_IDS) {
      expect(parseShipSearch({ ship: id })).toEqual({ ship: id });
    }
  });

  it('returns { ship: undefined } for unknown ship value', () => {
    expect(parseShipSearch({ ship: 'foo' })).toEqual({ ship: undefined });
  });

  it('returns { ship: undefined } for non-string ship value', () => {
    expect(parseShipSearch({ ship: 123 })).toEqual({ ship: undefined });
    expect(parseShipSearch({ ship: null })).toEqual({ ship: undefined });
    expect(parseShipSearch({ ship: undefined })).toEqual({ ship: undefined });
  });

  it('returns {} for empty input (no bad key to clear)', () => {
    expect(parseShipSearch({})).toEqual({});
  });

  it('strips unknown keys and clears bad ship', () => {
    expect(parseShipSearch({ ship: 'speederA', other: 'x' })).toEqual({ ship: 'speederA' });
    expect(parseShipSearch({ ship: 'foo', other: 'x' })).toEqual({ ship: undefined });
  });
});
