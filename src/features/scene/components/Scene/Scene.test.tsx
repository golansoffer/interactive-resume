import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { asCompanyId } from '../../types/company';
import type { Company } from '../../types/company';
import type { IntentStream } from '../../types/intent';
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

vi.mock('@react-three/drei', () => ({
  PerspectiveCamera: (): null => null,
  Html: (): null => null,
}));

const acme = asCompanyId('acme');
const globex = asCompanyId('globex');

const acmeCompany: Company = { id: acme, position: [5, 0, 0] };
const globexCompany: Company = { id: globex, position: [-5, 0, 0] };

const emptyIntents = (): IntentStream => ({ current: new Set() });

const twoCompanies = (): ReadonlyArray<Company> => [acmeCompany, globexCompany];

const mount = (
  state: SceneState,
  companies: ReadonlyArray<Company>,
  intents: IntentStream,
  onEvent: (event: SceneEvent) => void,
): void => {
  render(
    <Scene state={state} companies={companies} intents={intents} onEvent={onEvent} />,
  );
};

afterEach(() => {
  cleanup();
});

describe('Scene — mount smoke', () => {
  it('renders without throwing when state = { kind: "loading" }, empty companies, empty intent stream', () => {
    expect(() => mount({ kind: 'loading' }, [], emptyIntents(), vi.fn())).not.toThrow();
  });

  it('renders without throwing when state = { kind: "playing" } and a non-empty companies list', () => {
    expect(() => mount({ kind: 'playing' }, twoCompanies(), emptyIntents(), vi.fn())).not.toThrow();
  });

  it('renders without throwing when state = { kind: "revealing", objectId } and the companies list contains that id', () => {
    expect(() =>
      mount({ kind: 'revealing', objectId: acme }, twoCompanies(), emptyIntents(), vi.fn()),
    ).not.toThrow();
  });

  it('renders without throwing when state = { kind: "paused", resumeTo: { kind: "playing" } }', () => {
    expect(() =>
      mount(
        { kind: 'paused', resumeTo: { kind: 'playing' } },
        twoCompanies(),
        emptyIntents(),
        vi.fn(),
      ),
    ).not.toThrow();
  });
});

describe('Scene — port purity at mount', () => {
  it('does not invoke onEvent at mount under any SceneState variant', () => {
    const onEvent = vi.fn();
    mount({ kind: 'loading' }, twoCompanies(), emptyIntents(), onEvent);
    cleanup();
    mount({ kind: 'playing' }, twoCompanies(), emptyIntents(), onEvent);
    cleanup();
    mount({ kind: 'revealing', objectId: acme }, twoCompanies(), emptyIntents(), onEvent);
    cleanup();
    mount(
      { kind: 'paused', resumeTo: { kind: 'playing' } },
      twoCompanies(),
      emptyIntents(),
      onEvent,
    );
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('does not mutate the companies array across a mount + unmount cycle', () => {
    const companies = twoCompanies();
    const snapshotLength = companies.length;
    mount({ kind: 'playing' }, companies, emptyIntents(), vi.fn());
    cleanup();
    expect(companies.length).toBe(snapshotLength);
    expect(companies).toEqual([acmeCompany, globexCompany]);
    expect(Array.from(companies)).toEqual([acmeCompany, globexCompany]);
  });

  it('does not replace the IntentStream object identity or write to its current set', () => {
    const initialSet = new Set<'move_forward'>();
    const intents: IntentStream = { current: initialSet };
    mount({ kind: 'playing' }, twoCompanies(), intents, vi.fn());
    expect(intents.current).toBe(initialSet);
    expect(intents.current.size).toBe(0);
  });
});
