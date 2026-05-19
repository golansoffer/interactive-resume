import { describe, expect, it } from 'vitest';
import { SHIP_IDS } from './ship';
import { ALL_SHIPS, SHIP_REGISTRY, lookupShip } from './shipRegistry';

describe('SHIP_REGISTRY', () => {
  it('has an entry for every SHIP_ID', () => {
    for (const id of SHIP_IDS) {
      expect(SHIP_REGISTRY[id]).toBeDefined();
    }
  });

  it('each entry.id matches its key', () => {
    for (const id of SHIP_IDS) {
      expect(SHIP_REGISTRY[id].id).toBe(id);
    }
  });

  it('every glbPath points into the kenney-space-kit folder', () => {
    for (const id of SHIP_IDS) {
      expect(SHIP_REGISTRY[id].glbPath).toMatch(
        /^\/models\/kenney-space-kit\/craft_.+\.glb$/u,
      );
    }
  });

  it('every scale is finite and positive', () => {
    for (const id of SHIP_IDS) {
      const { scale } = SHIP_REGISTRY[id];
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThan(0);
    }
  });

  it('display names are unique', () => {
    const names = SHIP_IDS.map((id) => SHIP_REGISTRY[id].displayName);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('lookupShip', () => {
  it('returns the matching entry', () => {
    expect(lookupShip('speederA').id).toBe('speederA');
    expect(lookupShip('miner').id).toBe('miner');
  });
});

describe('ALL_SHIPS', () => {
  it('lists ships in SHIP_IDS order', () => {
    expect(ALL_SHIPS.map((entry) => entry.id)).toEqual([...SHIP_IDS]);
  });
});
