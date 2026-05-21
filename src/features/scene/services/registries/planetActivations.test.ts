import { describe, expect, it } from 'vitest';
import { createPlanetActivations } from './planetActivations';
import { asCompanyId, type CompanyId } from '../../types/company';

describe('createPlanetActivations', () => {
  const mave = asCompanyId('mave');
  const eightfig = asCompanyId('8fig');

  it('isActive(id) is false for any id before any publish call', () => {
    const activations = createPlanetActivations();
    expect(activations.isActive(mave)).toBe(false);
  });

  it('isActive(id) is true after publish with that id in the set', () => {
    const activations = createPlanetActivations();
    activations.publish(new Set([mave]));
    expect(activations.isActive(mave)).toBe(true);
    expect(activations.isActive(eightfig)).toBe(false);
  });

  it('anyActive() returns false on a fresh registry', () => {
    const activations = createPlanetActivations();
    expect(activations.anyActive()).toBe(false);
  });

  it('anyActive() returns true after publish with any non-empty set', () => {
    const activations = createPlanetActivations();
    activations.publish(new Set([mave]));
    expect(activations.anyActive()).toBe(true);
  });

  it('anyActive() returns false after publish with an empty set', () => {
    const activations = createPlanetActivations();
    activations.publish(new Set([mave]));
    activations.publish(new Set<CompanyId>());
    expect(activations.anyActive()).toBe(false);
  });
});
