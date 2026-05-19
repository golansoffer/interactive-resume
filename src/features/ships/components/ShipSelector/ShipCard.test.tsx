import type { ReactNode } from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHIP_REGISTRY } from '../../types/shipRegistry';
import { ShipCard } from './ShipCard';

vi.mock('@react-three/drei', () => ({
  View: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  useGLTF: (): { readonly scene: Record<string, never> } => ({ scene: {} }),
  PerspectiveCamera: (): null => null,
  Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
}));
vi.mock('@react-three/fiber', () => ({
  useFrame: (): null => null,
}));

const SHIP = SHIP_REGISTRY.speederA;

afterEach(() => {
  cleanup();
});

describe('ShipCard', () => {
  it('renders the ship display name', () => {
    render(
      <ShipCard
        ship={SHIP}
        isHovered={false}
        onHoverEnter={() => {}}
        onHoverLeave={() => {}}
        onPick={() => {}}
      />,
    );
    expect(screen.getByText('Speeder A')).toBeDefined();
  });

  it('is a button with type=button', () => {
    render(
      <ShipCard
        ship={SHIP}
        isHovered={false}
        onHoverEnter={() => {}}
        onHoverLeave={() => {}}
        onPick={() => {}}
      />,
    );
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('calls onHoverEnter(id) on mouseEnter', () => {
    const onHoverEnter = vi.fn();
    render(
      <ShipCard
        ship={SHIP}
        isHovered={false}
        onHoverEnter={onHoverEnter}
        onHoverLeave={() => {}}
        onPick={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(onHoverEnter).toHaveBeenCalledTimes(1);
    expect(onHoverEnter).toHaveBeenCalledWith('speederA');
  });

  it('calls onHoverLeave() on mouseLeave', () => {
    const onHoverLeave = vi.fn();
    render(
      <ShipCard
        ship={SHIP}
        isHovered={false}
        onHoverEnter={() => {}}
        onHoverLeave={onHoverLeave}
        onPick={() => {}}
      />,
    );
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(onHoverLeave).toHaveBeenCalledTimes(1);
    expect(onHoverLeave).toHaveBeenCalledWith();
  });

  it('calls onPick(id) on click', () => {
    const onPick = vi.fn();
    render(
      <ShipCard
        ship={SHIP}
        isHovered={false}
        onHoverEnter={() => {}}
        onHoverLeave={() => {}}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('speederA');
  });

  it('reflects isHovered via data-hovered', () => {
    const { rerender } = render(
      <ShipCard
        ship={SHIP}
        isHovered={false}
        onHoverEnter={() => {}}
        onHoverLeave={() => {}}
        onPick={() => {}}
      />,
    );
    expect(screen.getByRole('button').dataset['hovered']).toBe('false');
    rerender(
      <ShipCard
        ship={SHIP}
        isHovered
        onHoverEnter={() => {}}
        onHoverLeave={() => {}}
        onPick={() => {}}
      />,
    );
    expect(screen.getByRole('button').dataset['hovered']).toBe('true');
  });
});
