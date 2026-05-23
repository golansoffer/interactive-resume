import { describe, expect, it } from 'vitest';
import { phaseFromId } from './phaseFromId';

const TWO_PI = Math.PI * 2;

describe('phaseFromId', () => {
  it('returns 0 for the empty string', () => {
    expect(phaseFromId('')).toBe(0);
  });

  it('returns the same number for the same input across calls (deterministic)', () => {
    const a = phaseFromId('earth_b:moon');
    const b = phaseFromId('earth_b:moon');
    expect(a).toBe(b);
  });

  it('returns different numbers for different inputs (e.g. "a" vs "b")', () => {
    expect(phaseFromId('a')).not.toBe(phaseFromId('b'));
  });

  it('returns a value in [0, 2π) for any input across a sampled matrix', () => {
    const samples = ['', 'a', 'b', 'streamelements', 'earth_b:moon', 'jupiter_b', 'venus_a'];
    for (const id of samples) {
      const value = phaseFromId(id);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(TWO_PI);
    }
  });
});
