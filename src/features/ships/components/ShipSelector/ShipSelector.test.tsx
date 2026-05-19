import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_SHIPS, SHIP_REGISTRY } from '../../types/shipRegistry';
import type { HeroPhase } from '../../types/ship';
import { ShipSelector } from './ShipSelector';

vi.mock('@react-three/drei', () => {
  type FakeScene = {
    readonly clone: () => FakeScene;
    readonly traverse: (callback: (obj: unknown) => void) => void;
  };
  const makeFakeScene = (): FakeScene => ({
    clone: (): FakeScene => makeFakeScene(),
    traverse: (): void => {},
  });
  return {
    View: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
    useGLTF: (): { readonly scene: FakeScene } => ({ scene: makeFakeScene() }),
    PerspectiveCamera: (): null => null,
    Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  };
});
vi.mock('@react-three/fiber', () => ({ useFrame: (): null => null }));

const noop = (): void => {};

const stable = (id: keyof typeof SHIP_REGISTRY): HeroPhase => ({
  kind: 'stable',
  current: SHIP_REGISTRY[id],
});

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
        heroPhase={stable('speederA')}
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
        heroPhase={stable('speederA')}
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
        heroPhase={stable('speederA')}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    const hovered = thumbnailButtons().filter((b) => b.dataset['hovered'] === 'true');
    expect(hovered).toHaveLength(0);
  });

  it('renders the hero launch button when stable', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'none' }}
        heroPhase={stable('speederA')}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    expect(launchButton()).toBeDefined();
  });

  it('features the heroPhase.current ship when stable', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'none' }}
        heroPhase={stable('speederA')}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('Speeder A');
    const featured = thumbnailButtons().filter((b) => b.dataset['featured'] === 'true');
    expect(featured).toHaveLength(1);
    expect(featured[0]?.textContent).toContain('Speeder A');
  });

  it('features the heroPhase.incoming ship when transitioning (not the outgoing)', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'hovering', id: 'racer' }}
        heroPhase={{
          kind: 'transitioning',
          outgoing: SHIP_REGISTRY.speederA,
          incoming: SHIP_REGISTRY.racer,
          startedAt: 1000,
        }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    const featured = thumbnailButtons().filter((b) => b.dataset['featured'] === 'true');
    expect(featured).toHaveLength(1);
    expect(featured[0]?.textContent).toContain('Racer');
  });

  it('renders both outgoing and incoming hero info blocks during a transition', () => {
    render(
      <ShipSelector
        ships={ALL_SHIPS}
        hover={{ kind: 'hovering', id: 'racer' }}
        heroPhase={{
          kind: 'transitioning',
          outgoing: SHIP_REGISTRY.speederA,
          incoming: SHIP_REGISTRY.racer,
          startedAt: 1000,
        }}
        onHoverEnter={noop}
        onHoverLeave={noop}
        onPick={noop}
      />,
    );
    // Both hero info blocks render h2 headings — outgoing speederA + incoming racer.
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(2);
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toContain('Speeder A');
    expect(headingTexts).toContain('Racer');
  });
});
