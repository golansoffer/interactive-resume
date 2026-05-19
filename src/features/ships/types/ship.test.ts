import { describe, expect, it } from 'vitest';
import { DEFAULT_SHIP_ID, SHIP_IDS, shipCode } from './ship';
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

describe('DEFAULT_SHIP_ID', () => {
  it('is a known ship id', () => {
    expect(SHIP_IDS).toContain(DEFAULT_SHIP_ID);
  });
});

describe('shipCode', () => {
  it('maps each ship id to a short uppercase code', () => {
    expect(shipCode('speederA')).toBe('SPD-A');
    expect(shipCode('speederB')).toBe('SPD-B');
    expect(shipCode('speederC')).toBe('SPD-C');
    expect(shipCode('speederD')).toBe('SPD-D');
    expect(shipCode('cargoA')).toBe('CRG-A');
    expect(shipCode('cargoB')).toBe('CRG-B');
    expect(shipCode('racer')).toBe('RAC');
    expect(shipCode('miner')).toBe('MIN');
  });

  it('produces a unique code per ship', () => {
    const codes = SHIP_IDS.map((id) => shipCode(id));
    expect(new Set(codes).size).toBe(SHIP_IDS.length);
  });

  it('produces uppercase codes with only [A-Z-]', () => {
    for (const id of SHIP_IDS) {
      expect(shipCode(id)).toMatch(/^[A-Z-]+$/u);
    }
  });
});
