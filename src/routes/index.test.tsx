import { describe, expect, it } from 'vitest';
import type { ShipId } from '../features/ships/types/ship';
import { SHIP_IDS } from '../features/ships/types/ship';
import { SHIP_REGISTRY } from '../features/ships/types/shipRegistry';
import { toSelection } from './index';

describe('toSelection', () => {
  it('returns unselected for undefined', () => {
    const absent: ShipId | undefined = undefined;
    expect(toSelection(absent)).toEqual({ kind: 'unselected' });
  });

  it('returns selected with the matching registry entry for every SHIP_ID', () => {
    for (const id of SHIP_IDS) {
      const result = toSelection(id);
      expect(result.kind).toBe('selected');
      if (result.kind !== 'selected') throw new Error('expected selected variant');
      expect(result.ship).toBe(SHIP_REGISTRY[id]);
    }
  });
});
