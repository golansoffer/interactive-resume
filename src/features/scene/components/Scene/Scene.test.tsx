import type { ReactNode, RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { asCompanyId } from '../../types/company';
import type { CompanyEntry } from '../../types/company';
import type { IntentStream } from '../../types/intent';
import type { RouteProjection } from '../../types/route-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import type { ShipEntry } from '../../../ships/types/ship';
import { INITIAL_KINEMATICS, type Kinematics } from '../../types/kinematics';
import { Scene } from './Scene';

vi.mock('@react-three/fiber', () => {
  const fakeCamera = {
    getWorldDirection: <T extends { set: (x: number, y: number, z: number) => T }>(target: T): T =>
      target.set(0, 0, -1),
  };
  return {
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

vi.mock('@react-three/drei', () => ({
  PerspectiveCamera: (): null => null,
  Html: (): null => null,
  Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  Trail: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  useGLTF: Object.assign(
    (): { readonly scene: MockScene } => ({ scene: mockScene }),
    { preload: (): void => {} },
  ),
  useTexture: Object.assign(
    (): MockTexture => mockTexture,
    { preload: (): void => {} },
  ),
}));

const acme = asCompanyId('acme');
const globex = asCompanyId('globex');

const acmeEntry: CompanyEntry = {
  id: acme,
  planet: { assetId: 'earth_b', placement: [5, 0, 0] },
  info: {
    companyName: 'Acme',
    logo: { kind: 'with_icon', src: '/icons/acme.svg', backdrop: 'light' },
    website: { kind: 'has_website', url: 'https://acme.test/' },
    role: 'Engineer',
    period: { kind: 'ongoing', start: { year: 2024, month: 1 } },
    description: 'Acme description.',
  },
};

const EMPTY_ROUTE: RouteProjection = {
  kind: 'pre_route',
  firstTarget: { id: acme, placement: [5, 0, 0] },
};

const globexEntry: CompanyEntry = {
  id: globex,
  planet: { assetId: 'saturn_b', placement: [-5, 0, 0] },
  info: {
    companyName: 'Globex',
    logo: { kind: 'with_icon', src: '/icons/globex.svg', backdrop: 'light' },
    website: { kind: 'has_website', url: 'https://globex.test/' },
    role: 'Architect',
    period: {
      kind: 'closed',
      start: { year: 2020, month: 6 },
      end: { year: 2023, month: 12 },
    },
    description: 'Globex description.',
  },
};

const initech = asCompanyId('initech');
const umbrella = asCompanyId('umbrella');
const soylent = asCompanyId('soylent');

const initechEntry: CompanyEntry = {
  id: initech,
  planet: { assetId: 'mars_b', placement: [0, 0, 7] },
  info: {
    companyName: 'Initech',
    logo: { kind: 'no_icon' },
    website: { kind: 'no_website' },
    role: 'Engineer',
    period: { kind: 'ongoing', start: { year: 2021, month: 3 } },
    description: 'Initech description.',
  },
};

const umbrellaEntry: CompanyEntry = {
  id: umbrella,
  planet: { assetId: 'venus_b', placement: [0, 0, -7] },
  info: {
    companyName: 'Umbrella',
    logo: { kind: 'with_icon', src: '/icons/umbrella.svg', backdrop: 'dark' },
    website: { kind: 'has_website', url: 'https://umbrella.test/' },
    role: 'Researcher',
    period: { kind: 'ongoing', start: { year: 2022, month: 1 } },
    description: 'Umbrella description.',
  },
};

const soylentEntry: CompanyEntry = {
  id: soylent,
  planet: { assetId: 'uranus_b', placement: [7, 0, 0] },
  info: {
    companyName: 'Soylent',
    logo: { kind: 'with_icon', src: '/icons/soylent.svg', backdrop: 'dark' },
    website: { kind: 'has_website', url: 'https://soylent.test/' },
    role: 'Chemist',
    period: { kind: 'ongoing', start: { year: 2023, month: 1 } },
    description: 'Soylent description.',
  },
};

const emptyIntents = (): IntentStream => ({ current: new Set() });

const twoEntries = (): ReadonlyArray<CompanyEntry> => [acmeEntry, globexEntry];

const testShip: ShipEntry = {
  id: 'speederA',
  displayName: 'Speeder A',
  glbPath: '/models/kenney-space-kit/craft_speederA.glb',
  scale: 0.6,
};

const createKinematicsRef = (): RefObject<Kinematics> => ({ current: INITIAL_KINEMATICS });

const mount = (
  state: SceneState,
  entries: ReadonlyArray<CompanyEntry>,
  intents: IntentStream,
  onEvent: (event: SceneEvent) => void,
): void => {
  render(
    <Scene
      ship={testShip}
      state={state}
      entries={entries}
      fillerPlanets={[]}
      intents={intents}
      onEvent={onEvent}
      kinematicsRef={createKinematicsRef()}
      routeProjection={EMPTY_ROUTE}
    />,
  );
};

afterEach(() => {
  cleanup();
});

describe('Scene — mount smoke', () => {
  it('renders without throwing when state = { kind: "loading" }, empty entries, empty intent stream', () => {
    expect(() => mount({ kind: 'loading' }, [], emptyIntents(), vi.fn())).not.toThrow();
  });

  it('renders without throwing when state = { kind: "playing" } and a non-empty entries list', () => {
    expect(() => mount({ kind: 'playing' }, twoEntries(), emptyIntents(), vi.fn())).not.toThrow();
  });

  it('renders without throwing when state = { kind: "revealing", objectId }', () => {
    expect(() =>
      mount(
        { kind: 'revealing', objectId: acme },
        twoEntries(),
        emptyIntents(),
        vi.fn(),
      ),
    ).not.toThrow();
  });

  it('renders without throwing when state = { kind: "paused", resumeTo: { kind: "playing" } }', () => {
    expect(() =>
      mount(
        { kind: 'paused', resumeTo: { kind: 'playing' } },
        twoEntries(),
        emptyIntents(),
        vi.fn(),
      ),
    ).not.toThrow();
  });
});

describe('Scene — port purity at mount', () => {
  it('does not invoke onEvent at mount under any SceneState variant', () => {
    const onEvent = vi.fn();
    mount({ kind: 'loading' }, twoEntries(), emptyIntents(), onEvent);
    cleanup();
    mount({ kind: 'playing' }, twoEntries(), emptyIntents(), onEvent);
    cleanup();
    mount({ kind: 'revealing', objectId: acme }, twoEntries(), emptyIntents(), onEvent);
    cleanup();
    mount(
      { kind: 'paused', resumeTo: { kind: 'playing' } },
      twoEntries(),
      emptyIntents(),
      onEvent,
    );
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('does not mutate the entries array across a mount + unmount cycle', () => {
    const entries = twoEntries();
    const snapshotLength = entries.length;
    mount({ kind: 'playing' }, entries, emptyIntents(), vi.fn());
    cleanup();
    expect(entries.length).toBe(snapshotLength);
    expect(entries).toEqual([acmeEntry, globexEntry]);
  });

  it('does not replace the IntentStream object identity or write to its current set', () => {
    const initialSet = new Set<'move_forward'>();
    const intents: IntentStream = { current: initialSet };
    mount({ kind: 'playing' }, twoEntries(), intents, vi.fn());
    expect(intents.current).toBe(initialSet);
    expect(intents.current.size).toBe(0);
  });
});

describe('Scene — logo variant mixes', () => {
  const mixed: ReadonlyArray<CompanyEntry> = [acmeEntry, initechEntry, umbrellaEntry];
  const allNoIcon: ReadonlyArray<CompanyEntry> = [initechEntry];
  const allDarkIcon: ReadonlyArray<CompanyEntry> = [umbrellaEntry, soylentEntry];

  it('mounts without throwing when entries mix with_icon and no_icon companies', () => {
    expect(() => mount({ kind: 'playing' }, mixed, emptyIntents(), vi.fn())).not.toThrow();
  });

  it('mounts without throwing when every entry is no_icon', () => {
    expect(() => mount({ kind: 'playing' }, allNoIcon, emptyIntents(), vi.fn())).not.toThrow();
  });

  it("mounts without throwing when every entry is with_icon with backdrop 'dark'", () => {
    expect(() => mount({ kind: 'playing' }, allDarkIcon, emptyIntents(), vi.fn())).not.toThrow();
  });

  it('does not invoke onEvent at mount under any of the three mixes above', () => {
    const onEvent = vi.fn();
    mount({ kind: 'playing' }, mixed, emptyIntents(), onEvent);
    cleanup();
    mount({ kind: 'playing' }, allNoIcon, emptyIntents(), onEvent);
    cleanup();
    mount({ kind: 'playing' }, allDarkIcon, emptyIntents(), onEvent);
    expect(onEvent).not.toHaveBeenCalled();
  });
});
