import type { ReactNode } from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';

// Mock R3F so the scene doesn't try to render in jsdom.
vi.mock('@react-three/fiber', () => {
  const fakeCamera = {
    getWorldDirection: <T extends { set: (x: number, y: number, z: number) => T }>(target: T): T =>
      target.set(0, 0, -1),
  };
  return {
    Canvas: ({ children }: { readonly children?: ReactNode }): ReactNode => (
      <div data-testid="canvas">{children}</div>
    ),
    useFrame: (): null => null,
    useThree: <T,>(selector: (state: { camera: typeof fakeCamera }) => T): T =>
      selector({ camera: fakeCamera }),
  };
});

type MockScene = {
  readonly placeholder: true;
  readonly clone: () => MockScene;
  readonly traverse: (callback: (obj: unknown) => void) => void;
};

const mockScene: MockScene = {
  placeholder: true,
  clone: (): MockScene => mockScene,
  traverse: (): void => {
    // no children in the mock; the callback is intentionally not invoked
  },
};

type MockTexture = {
  magFilter: number;
  minFilter: number;
  colorSpace: string;
  needsUpdate: boolean;
};

const mockTexture: MockTexture = {
  magFilter: 0,
  minFilter: 0,
  colorSpace: '',
  needsUpdate: false,
};

type ViewMock = {
  (props: { readonly children?: ReactNode }): ReactNode;
  readonly Port: () => null;
};

const ViewMockImpl: ViewMock = Object.assign(
  ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  { Port: (): null => null },
);

vi.mock('@react-three/drei', () => ({
  View: ViewMockImpl,
  Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  PerspectiveCamera: (): null => null,
  Trail: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  Html: (): null => null,
  useGLTF: Object.assign(
    (): { readonly scene: MockScene } => ({ scene: mockScene }),
    { preload: (): void => {} },
  ),
  useTexture: Object.assign(
    (): MockTexture => mockTexture,
    { preload: (): void => {} },
  ),
}));

const mountAt = (initial: string) => {
  const history = createMemoryHistory({ initialEntries: [initial] });
  const router = createRouter({ routeTree, history });
  return { router, ui: <RouterProvider router={router} /> };
};

describe('route gate', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the selector when no ship is in the URL', async () => {
    const { ui } = mountAt('/');
    render(ui);
    expect(await screen.findByText('Choose your ship')).toBeDefined();
  });

  it('renders the scene when a valid ship is in the URL', async () => {
    const { ui } = mountAt('/?ship=speederA');
    render(ui);
    expect(await screen.findByTestId('canvas')).toBeDefined();
    expect(screen.queryByText('Choose your ship')).toBeNull();
  });

  it('falls back to the selector for an unknown ship value', async () => {
    const { ui } = mountAt('/?ship=foo');
    render(ui);
    expect(await screen.findByText('Choose your ship')).toBeDefined();
  });

  it('clicking a card navigates to ?ship=<id>', async () => {
    const { ui, router } = mountAt('/');
    render(ui);
    const card = await screen.findByText('Speeder A');
    fireEvent.click(card);
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    expect(router.state.location.search).toEqual({ ship: 'speederA' });
  });
});
