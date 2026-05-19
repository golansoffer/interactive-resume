import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_SHIPS } from '../../types/shipRegistry';
import { ShipSelector } from './ShipSelector';

vi.mock('@react-three/drei', () => {
  type FakeScene = { readonly clone: () => FakeScene };
  const makeFakeScene = (): FakeScene => ({ clone: (): FakeScene => makeFakeScene() });
  return {
    View: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
    useGLTF: (): { readonly scene: FakeScene } => ({ scene: makeFakeScene() }),
    PerspectiveCamera: (): null => null,
    Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  };
});
vi.mock('@react-three/fiber', () => ({ useFrame: (): null => null }));

const noop = (): void => {};

// Thumbnails carry data-hovered/data-featured; the launch button doesn't.
const thumbnailButtons = (): ReadonlyArray<HTMLElement> =>
  screen.getAllByRole('button').filter((b) => b.dataset['hovered'] !== undefined);

const launchButton = (): HTMLElement =>
  screen.getByRole('button', { name: /launch this craft/iu });

afterEach(() => {
  cleanup();
});

describe('ShipSelector', () => {
  it('renders one thumbnail button per ship', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'none' }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    expect(thumbnailButtons()).toHaveLength(8);
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
    const hovered = thumbnailButtons().filter((b) => b.dataset['hovered'] === 'true');
    expect(hovered).toHaveLength(1);
    expect(hovered[0]?.textContent).toContain('Cargo A');
  });

  it('marks zero cards as hovered when hover.kind === none', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'none' }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    const hovered = thumbnailButtons().filter((b) => b.dataset['hovered'] === 'true');
    expect(hovered).toHaveLength(0);
  });

  it('renders the hero launch button', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'none' }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    expect(launchButton()).toBeDefined();
  });

  it('features the first ship (Speeder A) when hover.kind === none', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'none' }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    // Hero heading reflects the featured ship's name.
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('Speeder A');
    const featured = thumbnailButtons().filter((b) => b.dataset['featured'] === 'true');
    expect(featured).toHaveLength(1);
    expect(featured[0]?.textContent).toContain('Speeder A');
  });

  it('features the hovered ship when hover.kind === hovering', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'hovering', id: 'racer' }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('Racer');
    const featured = thumbnailButtons().filter((b) => b.dataset['featured'] === 'true');
    expect(featured).toHaveLength(1);
    expect(featured[0]?.textContent).toContain('Racer');
  });
});
