import type { ReactNode } from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHIP_REGISTRY } from '../../types/shipRegistry';
import { HeroShip } from './HeroShip';

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

const SHIP = SHIP_REGISTRY.cargoB;

afterEach(() => {
  cleanup();
});

describe('HeroShip', () => {
  it('renders the ship display name', () => {
    render(<HeroShip ship={SHIP} onPick={(): void => {}} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Cargo B');
  });

  it('renders the ship code derived from the id', () => {
    render(<HeroShip ship={SHIP} onPick={(): void => {}} />);
    expect(screen.getByText('CRG-B')).toBeDefined();
  });

  it('renders the launch button labeled "Launch this craft"', () => {
    render(<HeroShip ship={SHIP} onPick={(): void => {}} />);
    expect(screen.getByRole('button', { name: /launch this craft/iu })).toBeDefined();
  });

  it('button has type=button', () => {
    render(<HeroShip ship={SHIP} onPick={(): void => {}} />);
    const btn = screen.getByRole('button', { name: /launch this craft/iu });
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('calls onPick(ship.id) when the launch button is clicked', () => {
    const onPick = vi.fn();
    render(<HeroShip ship={SHIP} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /launch this craft/iu }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('cargoB');
  });

  it('reflects a different ship after rerender (code + name update)', () => {
    const { rerender } = render(<HeroShip ship={SHIP} onPick={(): void => {}} />);
    expect(screen.getByText('CRG-B')).toBeDefined();
    rerender(<HeroShip ship={SHIP_REGISTRY.racer} onPick={(): void => {}} />);
    expect(screen.getByText('RAC')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Racer');
  });
});
