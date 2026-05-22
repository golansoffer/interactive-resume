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
  it('renders with data-rotates="true" when rotates=true', () => {
    const { container } = render(<PlanetCanvas assetId="mars_b" rotates={true} />);
    expect(container.querySelector('[data-rotates="true"]')).not.toBeNull();
  });

  it('renders with data-rotates="false" when rotates=false', () => {
    const { container } = render(<PlanetCanvas assetId="mars_b" rotates={false} />);
    expect(container.querySelector('[data-rotates="false"]')).not.toBeNull();
  });

  it('passes the assetId through as data-asset', () => {
    const { container } = render(<PlanetCanvas assetId="saturn_b" rotates={true} />);
    expect(container.querySelector('[data-asset="saturn_b"]')).not.toBeNull();
  });
});
