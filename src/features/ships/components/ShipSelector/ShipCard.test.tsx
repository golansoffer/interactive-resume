import type { ReactNode } from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHIP_REGISTRY } from '../../types/shipRegistry';
import { ShipCard } from './ShipCard';

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
vi.mock('@react-three/fiber', () => ({
  useFrame: (): null => null,
}));

const SHIP = SHIP_REGISTRY.speederA;

const baseProps = {
  ship: SHIP,
  index: 1,
  isHovered: false,
  isFeatured: false,
  onHoverEnter: (): void => {},
  onHoverLeave: (): void => {},
  onPick: (): void => {},
};

afterEach(() => {
  cleanup();
});

describe('ShipCard', () => {
  it('renders the ship display name', () => {
    render(<ShipCard {...baseProps} />);
    expect(screen.getByText('Speeder A')).toBeDefined();
  });

  it('renders the ship code from the id', () => {
    render(<ShipCard {...baseProps} />);
    expect(screen.getByText('SPD-A')).toBeDefined();
  });

  it('renders the padded index ("01" for index=1)', () => {
    render(<ShipCard {...baseProps} index={1} />);
    expect(screen.getByText('01')).toBeDefined();
  });

  it('renders the padded index ("05" for index=5)', () => {
    render(<ShipCard {...baseProps} index={5} />);
    expect(screen.getByText('05')).toBeDefined();
  });

  it('is a button with type=button', () => {
    render(<ShipCard {...baseProps} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('calls onHoverEnter(id) on mouseEnter', () => {
    const onHoverEnter = vi.fn();
    render(<ShipCard {...baseProps} onHoverEnter={onHoverEnter} />);
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(onHoverEnter).toHaveBeenCalledTimes(1);
    expect(onHoverEnter).toHaveBeenCalledWith('speederA');
  });

  it('calls onHoverLeave() on mouseLeave', () => {
    const onHoverLeave = vi.fn();
    render(<ShipCard {...baseProps} onHoverLeave={onHoverLeave} />);
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(onHoverLeave).toHaveBeenCalledTimes(1);
    expect(onHoverLeave).toHaveBeenCalledWith();
  });

  it('calls onPick(id) on click', () => {
    const onPick = vi.fn();
    render(<ShipCard {...baseProps} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('speederA');
  });

  it('reflects isHovered via data-hovered', () => {
    const { rerender } = render(<ShipCard {...baseProps} isHovered={false} />);
    expect(screen.getByRole('button').dataset['hovered']).toBe('false');
    rerender(<ShipCard {...baseProps} isHovered />);
    expect(screen.getByRole('button').dataset['hovered']).toBe('true');
  });

  it('reflects isFeatured via data-featured', () => {
    const { rerender } = render(<ShipCard {...baseProps} isFeatured={false} />);
    expect(screen.getByRole('button').dataset['featured']).toBe('false');
    rerender(<ShipCard {...baseProps} isFeatured />);
    expect(screen.getByRole('button').dataset['featured']).toBe('true');
  });
});
