import type { ReactNode } from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHIP_REGISTRY } from '../../types/shipRegistry';
import type { HeroPhase } from '../../types/ship';
import { HeroShip } from './HeroShip';

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

const CARGO_B = SHIP_REGISTRY.cargoB;
const RACER = SHIP_REGISTRY.racer;

const stable = (ship: typeof CARGO_B): HeroPhase => ({ kind: 'stable', current: ship });
const transitioning = (out: typeof CARGO_B, inc: typeof CARGO_B): HeroPhase => ({
  kind: 'transitioning',
  outgoing: out,
  incoming: inc,
  startedAt: 1000,
});

afterEach(() => {
  cleanup();
});

describe('HeroShip — stable phase', () => {
  it('renders the current ship display name', () => {
    render(<HeroShip phase={stable(CARGO_B)} onPick={(): void => {}} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Cargo B');
  });

  it('renders the current ship code derived from the id', () => {
    render(<HeroShip phase={stable(CARGO_B)} onPick={(): void => {}} />);
    expect(screen.getByText('CRG-B')).toBeDefined();
  });

  it('renders the launch button labeled "Launch this craft"', () => {
    render(<HeroShip phase={stable(CARGO_B)} onPick={(): void => {}} />);
    expect(screen.getByRole('button', { name: /launch this craft/iu })).toBeDefined();
  });

  it('button has type=button', () => {
    render(<HeroShip phase={stable(CARGO_B)} onPick={(): void => {}} />);
    const btn = screen.getByRole('button', { name: /launch this craft/iu });
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('calls onPick(current.id) when the launch button is clicked', () => {
    const onPick = vi.fn();
    render(<HeroShip phase={stable(CARGO_B)} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /launch this craft/iu }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('cargoB');
  });

  it('reflects a different ship after rerender (code + name update)', () => {
    const { rerender } = render(<HeroShip phase={stable(CARGO_B)} onPick={(): void => {}} />);
    expect(screen.getByText('CRG-B')).toBeDefined();
    rerender(<HeroShip phase={stable(RACER)} onPick={(): void => {}} />);
    expect(screen.getByText('RAC')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Racer');
  });
});

describe('HeroShip — transitioning phase', () => {
  it('renders both outgoing and incoming info blocks', () => {
    render(<HeroShip phase={transitioning(CARGO_B, RACER)} onPick={(): void => {}} />);
    expect(screen.getByText('CRG-B')).toBeDefined();
    expect(screen.getByText('RAC')).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
  });

  it('mounts two launch buttons (one per block) during a swap', () => {
    render(<HeroShip phase={transitioning(CARGO_B, RACER)} onPick={(): void => {}} />);
    expect(screen.getAllByRole('button', { name: /launch this craft/iu })).toHaveLength(2);
  });

  it('the outgoing block carries the fadeOut animation class', () => {
    render(<HeroShip phase={transitioning(CARGO_B, RACER)} onPick={(): void => {}} />);
    const outgoingHeading = screen.getByText('Cargo B').closest('div');
    expect(outgoingHeading?.className).toContain('animate-[fadeOut');
  });

  it('the incoming block carries the fadeIn animation class', () => {
    render(<HeroShip phase={transitioning(CARGO_B, RACER)} onPick={(): void => {}} />);
    const incomingHeading = screen.getByText('Racer').closest('div');
    expect(incomingHeading?.className).toContain('animate-[fadeIn');
  });
});
