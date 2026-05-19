import { describe, expect, it } from 'vitest';
import { SHIP_IDS } from '../types/ship';
import { parseShipSearch } from './shipSearch';

describe('parseShipSearch', () => {
  it('accepts every SHIP_ID', () => {
    for (const id of SHIP_IDS) {
      expect(parseShipSearch({ ship: id })).toEqual({ ship: id });
    }
  });

  it('returns {} for unknown ship value', () => {
    expect(parseShipSearch({ ship: 'foo' })).toEqual({});
  });

  it('returns {} for non-string ship value', () => {
    expect(parseShipSearch({ ship: 123 })).toEqual({});
    expect(parseShipSearch({ ship: null })).toEqual({});
    expect(parseShipSearch({ ship: undefined })).toEqual({});
  });

  it('returns {} for empty input', () => {
    expect(parseShipSearch({})).toEqual({});
  });

  it('strips unknown keys', () => {
    expect(parseShipSearch({ ship: 'speederA', other: 'x' })).toEqual({ ship: 'speederA' });
  });
});
