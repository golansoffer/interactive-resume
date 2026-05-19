import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { asCompanyId } from '../../types/company';
import type { CompanyEntry } from '../../types/company';
import type { IntentStream } from '../../types/intent';
import type { RevealProjection } from '../../types/reveal-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
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
};

const mockScene: MockScene = {
  placeholder: true,
  clone: (): MockScene => mockScene,
};

vi.mock('@react-three/drei', () => ({
  PerspectiveCamera: (): null => null,
  Html: (): null => null,
  Center: ({ children }: { readonly children?: ReactNode }): ReactNode => children,
  useGLTF: Object.assign(
    (): { readonly scene: MockScene } => ({ scene: mockScene }),
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
    logoSrc: '/logos/acme.svg',
    role: 'Engineer',
    period: { kind: 'ongoing', start: { year: 2024, month: 1 } },
    description: 'Acme description.',
  },
};

const globexEntry: CompanyEntry = {
  id: globex,
  planet: { assetId: 'saturn_b', placement: [-5, 0, 0] },
  info: {
    companyName: 'Globex',
    logoSrc: '/logos/globex.svg',
    role: 'Architect',
    period: {
      kind: 'closed',
      start: { year: 2020, month: 6 },
      end: { year: 2023, month: 12 },
    },
    description: 'Globex description.',
  },
};

const emptyIntents = (): IntentStream => ({ current: new Set() });

const twoEntries = (): ReadonlyArray<CompanyEntry> => [acmeEntry, globexEntry];

const hidden: RevealProjection = { kind: 'hidden' };

const mount = (
  state: SceneState,
  entries: ReadonlyArray<CompanyEntry>,
  intents: IntentStream,
  onEvent: (event: SceneEvent) => void,
  revealProjection: RevealProjection = hidden,
): void => {
  render(
    <Scene
      state={state}
      entries={entries}
      intents={intents}
      onEvent={onEvent}
      revealProjection={revealProjection}
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

  it('renders without throwing when state = { kind: "revealing", objectId } with matching visible reveal projection', () => {
    const visible: RevealProjection = {
      kind: 'visible',
      info: acmeEntry.info,
      placement: acmeEntry.planet.placement,
    };
    expect(() =>
      mount(
        { kind: 'revealing', objectId: acme },
        twoEntries(),
        emptyIntents(),
        vi.fn(),
        visible,
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
