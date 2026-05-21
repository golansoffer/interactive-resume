import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { asCompanyId, type CompanyId } from '../../features/scene/types/company';
import { sceneMachine } from './sceneMachine';
import type { SceneMachineEvent } from './sceneMachine';

const acme = asCompanyId('acme');
const globex = asCompanyId('globex');

const runVisited = (events: ReadonlyArray<SceneMachineEvent>): ReadonlyArray<CompanyId> => {
  const actor = createActor(sceneMachine).start();
  for (const event of events) {
    actor.send(event);
  }
  const visited = actor.getSnapshot().context.visited;
  actor.stop();
  return visited;
};

describe('sceneMachine — visited tracking', () => {
  it('starts with an empty visited array', () => {
    expect(runVisited([{ type: 'start' }])).toEqual([]);
  });

  it('appends a new id to visited on entered_proximity', () => {
    expect(
      runVisited([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
      ]),
    ).toEqual([acme]);
  });

  it('appends multiple new ids in order', () => {
    expect(
      runVisited([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'entered_proximity', objectId: globex },
      ]),
    ).toEqual([acme, globex]);
  });

  it('moves an existing id to the end on re-entry (length unchanged, order updated)', () => {
    expect(
      runVisited([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'entered_proximity', objectId: globex },
        { type: 'entered_proximity', objectId: acme },
      ]),
    ).toEqual([globex, acme]);
  });

  it('exited_proximity does not modify visited', () => {
    expect(
      runVisited([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'exited_proximity', objectId: acme },
      ]),
    ).toEqual([acme]);
  });

  it('pause_toggle does not modify visited', () => {
    expect(
      runVisited([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'pause_toggle' },
      ]),
    ).toEqual([acme]);
  });

  it('start does not modify visited', () => {
    expect(
      runVisited([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'start' },
      ]),
    ).toEqual([acme]);
  });

  it('interact does not modify visited', () => {
    expect(
      runVisited([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'interact' },
      ]),
    ).toEqual([acme]);
  });
});
