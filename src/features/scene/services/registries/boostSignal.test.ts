import { describe, expect, it } from 'vitest';
import { createBoostSignal } from './boostSignal';

describe('createBoostSignal', () => {
  it('read() returns { active: false, factor: 0 } before any write', () => {
    const signal = createBoostSignal();
    expect(signal.read()).toEqual({ active: false, factor: 0 });
  });

  it('write(true, 0.4) followed by read() returns { active: true, factor: 0.4 }', () => {
    const signal = createBoostSignal();
    signal.write(true, 0.4);
    expect(signal.read()).toEqual({ active: true, factor: 0.4 });
  });

  it('write(false, 0) returns the registry to the inert state', () => {
    const signal = createBoostSignal();
    signal.write(true, 1);
    signal.write(false, 0);
    expect(signal.read()).toEqual({ active: false, factor: 0 });
  });
});
