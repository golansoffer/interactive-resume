import { describe, expect, it } from 'vitest';
import { satelliteOffset } from './satelliteOffset';
import type { SatelliteOrbit } from '../../types/satellite';

const FLAT: SatelliteOrbit = { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 };

describe('satelliteOffset', () => {
  it('returns [0, 0, radius] for time zero with zero phase and zero inclination (moon starts behind the planet on the +Z depth axis)', () => {
    const [x, y, z] = satelliteOffset(FLAT, 0);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(5, 6);
  });

  it('returns [radius, 0, 0] for one quarter of the period with zero phase and zero inclination (moon swings sideways into +X)', () => {
    const [x, y, z] = satelliteOffset(FLAT, 2.5);
    expect(x).toBeCloseTo(5, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('returns [0, 0, -radius] for half of the period with zero phase and zero inclination (moon is in front of the planet on the -Z depth axis)', () => {
    const [x, y, z] = satelliteOffset(FLAT, 5);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-5, 6);
  });

  it('returns [-radius, 0, 0] for three quarters of the period with zero phase and zero inclination (moon swings sideways into -X)', () => {
    const [x, y, z] = satelliteOffset(FLAT, 7.5);
    expect(x).toBeCloseTo(-5, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('returns the same offset at one full period as at time zero (orbit closes)', () => {
    const [x0, y0, z0] = satelliteOffset(FLAT, 0);
    const [xT, yT, zT] = satelliteOffset(FLAT, 10);
    expect(xT).toBeCloseTo(x0, 6);
    expect(yT).toBeCloseTo(y0, 6);
    expect(zT).toBeCloseTo(z0, 6);
  });

  it('keeps the y component at zero for every sampled time when inclinationDeg is zero', () => {
    const samples = [0, 1, 2.5, 5, 7.5, 9.999];
    for (const t of samples) {
      const [, y] = satelliteOffset(FLAT, t);
      expect(y).toBeCloseTo(0, 6);
    }
  });

  it('returns [0, radius, 0] at one quarter of the period when inclinationDeg is 90 (planar swing collapses fully into y, x collapses to zero)', () => {
    const orbit: SatelliteOrbit = { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 90 };
    const [x, y, z] = satelliteOffset(orbit, 2.5);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(5, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('returns [0, ±radius, 0] across the full quarter/three-quarter sweep when inclinationDeg is 90 (orbit lies in the YZ plane; x stays zero)', () => {
    const orbit: SatelliteOrbit = { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 90 };
    const [, yQuarter] = satelliteOffset(orbit, 2.5);
    const [, yThreeQuarter] = satelliteOffset(orbit, 7.5);
    expect(yQuarter).toBeCloseTo(5, 6);
    expect(yThreeQuarter).toBeCloseTo(-5, 6);
    const samples = [0, 1, 2.5, 5, 7.5, 9.999];
    for (const t of samples) {
      const [x] = satelliteOffset(orbit, t);
      expect(x).toBeCloseTo(0, 6);
    }
  });

  it('produces a non-zero y at one quarter of the period when inclinationDeg is 30', () => {
    const orbit: SatelliteOrbit = { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 30 };
    const [, y] = satelliteOffset(orbit, 2.5);
    expect(Math.abs(y)).toBeGreaterThan(0);
  });

  it('keeps x² + y² + z² equal to radius² at every sampled time across non-zero inclination (offset stays on the orbit sphere)', () => {
    const orbit: SatelliteOrbit = { radius: 5, periodSeconds: 10, phase: 0.7, inclinationDeg: 30 };
    const samples = [0, 1.25, 2.5, 3.75, 5, 6.25, 7.5, 8.75];
    for (const t of samples) {
      const [x, y, z] = satelliteOffset(orbit, t);
      expect(x * x + y * y + z * z).toBeCloseTo(25, 4);
    }
  });

  it('returns the same offset for (phase: π, timeSeconds: 0) as for (phase: 0, timeSeconds: periodSeconds / 2) (phase shifts the starting angle)', () => {
    const a = satelliteOffset(
      { radius: 5, periodSeconds: 10, phase: Math.PI, inclinationDeg: 0 },
      0,
    );
    const b = satelliteOffset(
      { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 },
      5,
    );
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
    expect(a[2]).toBeCloseTo(b[2], 6);
  });

  it('returns the same offset for (phase: 2π, timeSeconds: 0) as for (phase: 0, timeSeconds: 0) (phase is mod 2π)', () => {
    const a = satelliteOffset(
      { radius: 5, periodSeconds: 10, phase: Math.PI * 2, inclinationDeg: 0 },
      0,
    );
    const b = satelliteOffset(
      { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 },
      0,
    );
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
    expect(a[2]).toBeCloseTo(b[2], 6);
  });

  it('returns the offset at (periodSeconds: 5, timeSeconds: 2.5) equal to the offset at (periodSeconds: 10, timeSeconds: 5) for otherwise-equal orbits (angular frequency is the inverse of the period)', () => {
    const a = satelliteOffset(
      { radius: 5, periodSeconds: 5, phase: 0, inclinationDeg: 0 },
      2.5,
    );
    const b = satelliteOffset(
      { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 },
      5,
    );
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
    expect(a[2]).toBeCloseTo(b[2], 6);
  });

  it('returns the same offset across two successive calls with identical inputs (deterministic)', () => {
    const orbit: SatelliteOrbit = { radius: 6, periodSeconds: 10, phase: 0.7, inclinationDeg: 15 };
    const a = satelliteOffset(orbit, 3.14);
    const b = satelliteOffset(orbit, 3.14);
    expect(a[0]).toBe(b[0]);
    expect(a[1]).toBe(b[1]);
    expect(a[2]).toBe(b[2]);
  });

  it('leaves the input orbit object unchanged after the call (no mutation of radius, periodSeconds, phase, inclinationDeg)', () => {
    const orbit: SatelliteOrbit = { radius: 6, periodSeconds: 10, phase: 0.7, inclinationDeg: 15 };
    const snapshot: SatelliteOrbit = {
      radius: orbit.radius,
      periodSeconds: orbit.periodSeconds,
      phase: orbit.phase,
      inclinationDeg: orbit.inclinationDeg,
    };
    for (const t of [0, 1, 2.5, 5]) satelliteOffset(orbit, t);
    expect(orbit).toEqual(snapshot);
  });

  it('returns a fresh tuple instance on each call (no shared / cached singleton)', () => {
    const orbit: SatelliteOrbit = { radius: 6, periodSeconds: 10, phase: 0, inclinationDeg: 0 };
    const a = satelliteOffset(orbit, 1);
    const b = satelliteOffset(orbit, 1);
    expect(a).not.toBe(b);
  });

  it('returns finite numeric components for every sampled (orbit, timeSeconds) pair across the test matrix (no NaN, no Infinity)', () => {
    const orbits: ReadonlyArray<SatelliteOrbit> = [
      { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 0 },
      { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 30 },
      { radius: 5, periodSeconds: 10, phase: 0, inclinationDeg: 90 },
      { radius: 6, periodSeconds: 5, phase: 0.7, inclinationDeg: 15 },
      { radius: 6, periodSeconds: 10, phase: Math.PI, inclinationDeg: 45 },
    ];
    const times = [0, 1, 2.5, 5, 7.5, 9.999, 10, 100];
    for (const orbit of orbits) {
      for (const t of times) {
        const [x, y, z] = satelliteOffset(orbit, t);
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);
      }
    }
  });
});
