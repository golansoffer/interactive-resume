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
    position: { x: 0, y: 0, z: 0 },
    getWorldDirection: <T extends { set: (x: number, y: number, z: number) => T }>(target: T): T =>
      target.set(0, 0, -1),
  };
  const fakeClock = { elapsedTime: 0 };
  return {
    Canvas: ({ children }: { readonly children?: ReactNode }): ReactNode => (
      <div data-testid="canvas">{children}</div>
    ),
    useFrame: (): null => null,
    useThree: <T,>(
      selector: (state: { camera: typeof fakeCamera; clock: typeof fakeClock }) => T,
    ): T => selector({ camera: fakeCamera, clock: fakeClock }),
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
  Trail: (): null => null,
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

// PlanetCanvas drives the real planet-rendering pipeline (cloneAndDress,
// computePlanetPreviewFit, etc.) which expects a real three.js Object3D.
// In this smoke test we only care that the route gate composes correctly,
// not that planets render — stub the whole helper.
vi.mock('../features/progress/components/ProgressCard/PlanetCanvas', () => ({
  PlanetCanvas: ({ assetId }: { readonly assetId: string }): ReactNode => (
    <div data-mock-planet data-asset={assetId} />
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
    // Multiple Canvas instances now: the main scene canvas, the
    // progress card's headline planet, and 5 pip canvases.
    const canvases = await screen.findAllByTestId('canvas');
    expect(canvases.length).toBeGreaterThan(0);
    expect(screen.queryByText('Choose your ship')).toBeNull();
  });

  it('falls back to the selector for an unknown ship value', async () => {
    const { ui } = mountAt('/?ship=foo');
    render(ui);
    expect(await screen.findByText('Choose your ship')).toBeDefined();
  });

  it('clicking the launch button navigates to ?ship=<id>', async () => {
    const { ui, router } = mountAt('/');
    render(ui);
    const launch = await screen.findByRole('button', { name: /launch this craft/iu });
    fireEvent.click(launch);
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    // Default featured ship is Speeder A (no hover); launch commits that pick.
    expect(router.state.location.search).toEqual({ ship: 'speederA' });
  });
});

type ChangeListener = (event: { readonly matches: boolean }) => void;

type FakeMediaQueryList = {
  matches: boolean;
  readonly addEventListener: (type: 'change', listener: ChangeListener) => void;
  readonly removeEventListener: (type: 'change', listener: ChangeListener) => void;
};

const createFakeMediaQueryList = (initialMatches: boolean): FakeMediaQueryList => {
  const listeners = new Set<ChangeListener>();
  return {
    matches: initialMatches,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
};

const stubMatchMedia = (list: FakeMediaQueryList): void => {
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window, {
      matchMedia: vi.fn(() => list),
    }),
  );
};

describe('root-level device-support gate', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the unsupported splash and hides the canvas when matchMedia reports no match', async () => {
    stubMatchMedia(createFakeMediaQueryList(false));
    const { ui } = mountAt('/?ship=speederA');
    render(ui);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Open this on desktop.' }),
    ).toBeDefined();
    expect(screen.queryAllByTestId('canvas').length).toBe(0);
    expect(screen.queryByText('Choose your ship')).toBeNull();
  });

  it('renders the normal scene and hides the unsupported splash when matchMedia reports a match', async () => {
    stubMatchMedia(createFakeMediaQueryList(true));
    const { ui } = mountAt('/?ship=speederA');
    render(ui);
    const canvases = await screen.findAllByTestId('canvas');
    expect(canvases.length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Open this on desktop.' }),
    ).toBeNull();
  });
});
