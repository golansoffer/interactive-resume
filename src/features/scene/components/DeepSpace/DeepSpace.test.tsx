import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Vector3 } from 'three';
import { DeepSpace } from './DeepSpace';

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
  Trail: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  useTexture: (): object => ({
    mapping: 0,
    colorSpace: '',
  }),
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  Bloom: (): null => null,
  Vignette: (): null => null,
}));

afterEach(() => cleanup());

describe('DeepSpace — mount smoke', () => {
  it('renders without throwing', () => {
    expect(() => render(<DeepSpace />)).not.toThrow();
  });
});
