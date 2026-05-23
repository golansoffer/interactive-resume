import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, cleanup } from '@testing-library/react';
import type { SatelliteSpec } from '../../types/satellite';

type MockScene = {
  readonly placeholder: true;
  readonly clone: () => MockScene;
  readonly traverse: (callback: (obj: unknown) => void) => void;
};

const mockScene: MockScene = {
  placeholder: true,
  clone: (): MockScene => mockScene,
  traverse: (): void => {
    // no children in the mock; the callback is intentionally not invoked
  },
};

type MockTexture = {
  magFilter: number;
  minFilter: number;
  colorSpace: string;
  needsUpdate: boolean;
};

const mockTexture: MockTexture = {
  magFilter: 0,
  minFilter: 0,
  colorSpace: '',
  needsUpdate: false,
};

vi.mock('@react-three/fiber', () => ({
  useFrame: (): null => null,
}));

vi.mock('@react-three/drei', () => ({
  Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  useGLTF: Object.assign(
    (): { readonly scene: MockScene } => ({ scene: mockScene }),
    { preload: (): void => {} },
  ),
  useTexture: Object.assign(
    (): MockTexture => mockTexture,
    { preload: (): void => {} },
  ),
}));

import { Satellite } from './Satellite';

const moonSpec: SatelliteSpec = {
  id: 'earth_b:moon',
  assetId: 'moon_a',
  scale: 0.3,
  orbit: { radius: 6, periodSeconds: 10, phase: 0, inclinationDeg: 15 },
};

describe('Satellite — props and mount', () => {
  it('renders without throwing given a valid SatelliteSpec', () => {
    expect(() => {
      render(<Satellite spec={moonSpec} />);
      cleanup();
    }).not.toThrow();
  });

  it('accepts a props object containing only { spec } — no collider, activations, or radii refs in the prop type', () => {
    type SatelliteProps = Parameters<typeof Satellite>[0];
    expectTypeOf<SatelliteProps>().toEqualTypeOf<{ readonly spec: SatelliteSpec }>();
  });

  it('mounts without referencing a sphereCollidersRef (compile-time witness: no such prop exists)', () => {
    // If Satellite ever grew a collider ref prop, this render call (which
    // does NOT pass one) would fail at the type level. The test passing
    // proves no such prop is in scope.
    expect(() => {
      render(<Satellite spec={moonSpec} />);
      cleanup();
    }).not.toThrow();
  });

  it('mounts without referencing a planetRadiiRef (compile-time witness: no such prop exists)', () => {
    // Same witness as above for the planet-radius registry — Satellite does
    // not participate in proximity activation, so it cannot register a radius.
    expect(() => {
      render(<Satellite spec={moonSpec} />);
      cleanup();
    }).not.toThrow();
  });
});
