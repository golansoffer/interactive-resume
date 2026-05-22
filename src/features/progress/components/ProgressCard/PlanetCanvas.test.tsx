import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { PlanetCanvas } from './PlanetCanvas';

// jsdom doesn't support WebGL — stub @react-three/fiber's Canvas so we can
// at least mount the wrapper. We only test the wrapper attributes here.
vi.mock('@react-three/fiber', () => ({
  // Swallow children — jsdom can't run WebGL; we only check the outer wrapper.
  Canvas: (_props: { readonly children?: ReactNode }): JSX.Element => (
    <div data-test-canvas />
  ),
  useFrame: (): void => {},
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: (): unknown => ({}) } }),
  useTexture: () => ({}),
}));

describe('PlanetCanvas', () => {
  it('renders a wrapper for the given asset', () => {
    const { container } = render(<PlanetCanvas assetId="saturn_b" />);
    expect(container.querySelector('[data-asset="saturn_b"]')).not.toBeNull();
  });

  it('mounts the Canvas inside the wrapper', () => {
    const { container } = render(<PlanetCanvas assetId="mars_b" />);
    expect(container.querySelector('[data-test-canvas]')).not.toBeNull();
  });
});
