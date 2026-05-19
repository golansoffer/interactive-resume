import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_SHIPS } from '../../types/shipRegistry';
import { ShipSelector } from './ShipSelector';

vi.mock('@react-three/drei', () => ({
  View: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  useGLTF: (): { readonly scene: Record<string, never> } => ({ scene: {} }),
  PerspectiveCamera: (): null => null,
  Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
}));
vi.mock('@react-three/fiber', () => ({ useFrame: (): null => null }));

const noop = (): void => {};

afterEach(() => {
  cleanup();
});

describe('ShipSelector', () => {
  it('renders one button per ship', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'none' }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(8);
  });

  it('marks only the hovered card with data-hovered=true', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'hovering', id: 'cargoA' }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    const hovered = screen.getAllByRole('button').filter(
      (b) => b.dataset['hovered'] === 'true',
    );
    expect(hovered).toHaveLength(1);
    expect(hovered[0]?.textContent).toContain('Cargo A');
  });

  it('marks zero cards when hover.kind === none', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'none' }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    const hovered = screen.getAllByRole('button').filter(
      (b) => b.dataset['hovered'] === 'true',
    );
    expect(hovered).toHaveLength(0);
  });
});
