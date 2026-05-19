import { describe, expect, it } from 'vitest';
import { SHIP_IDS } from './ship';
import type { ShipId } from './ship';

describe('SHIP_IDS', () => {
  it('lists exactly 8 ships', () => {
    expect(SHIP_IDS).toHaveLength(8);
  });

  it('contains the expected ids', () => {
    expect([...SHIP_IDS]).toEqual([
      'speederA', 'speederB', 'speederC', 'speederD',
      'cargoA', 'cargoB',
      'racer', 'miner',
    ]);
  });

  it('has unique ids', () => {
    const set = new Set<ShipId>(SHIP_IDS);
    expect(set.size).toBe(SHIP_IDS.length);
  });
});
