import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DeepSpace } from './DeepSpace';

vi.mock('@react-three/fiber', () => ({
  useFrame: (): null => null,
}));

vi.mock('@react-three/drei', () => ({
  Environment: (): null => null,
  Stars: (): null => null,
  Trail: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
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
