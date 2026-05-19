import { describe, expect, it } from 'vitest';
import { SHIP_IDS } from './ship';
import type { ShipId } from './ship';

describe('SHIP_IDS', () => {
  it('lists exactly 5 ships', () => {
    expect(SHIP_IDS).toHaveLength(5);
  });

  it('contains the expected ids', () => {
    expect([...SHIP_IDS]).toEqual([
      'speederA',
      'cargoA', 'cargoB',
      'racer', 'miner',
    ]);
  });

  it('has unique ids', () => {
    const set = new Set<ShipId>(SHIP_IDS);
    expect(set.size).toBe(SHIP_IDS.length);
  });
});
