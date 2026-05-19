import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Vector3 } from 'three';
import { DeepSpace } from './DeepSpace';
import type { Kinematics } from '../../services/renderer/integrateMotion';

vi.mock('@react-three/fiber', () => {
  const fakeCamera = { position: new Vector3(0, 0, 0) };
  return {
    useFrame: (): null => null,
    useThree: <T,>(selector: (state: { camera: typeof fakeCamera }) => T): T =>
      selector({ camera: fakeCamera }),
  };
});

vi.mock('@react-three/drei', () => ({
  Stars: (): null => null,
  Sparkles: (): null => null,
  Cloud: (): null => null,
  Clouds: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  Bloom: (): null => null,
  Vignette: (): null => null,
  ChromaticAberration: (): null => null,
}));

const kinematicsRef = {
  current: {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    heading: 0,
  } as Kinematics,
};

afterEach(() => cleanup());

describe('DeepSpace — mount smoke', () => {
  it('renders without throwing with default props', () => {
    expect(() => render(<DeepSpace kinematicsRef={kinematicsRef} />)).not.toThrow();
  });

  it('renders without throwing with all props supplied', () => {
    expect(() =>
      render(
        <DeepSpace
          kinematicsRef={kinematicsRef}
          palette={{
            base: [0.1, 0.1, 0.2],
            accent: [0.2, 0.3, 0.4],
            highlight: [0.9, 0.8, 0.5],
          }}
          intensity={0.7}
          starDensity={1.2}
          motionResponse={0.5}
        />,
      ),
    ).not.toThrow();
  });
});
