import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { asCompanyId, type CompanyId } from '../../features/scene/types/company';
import type { SceneState } from '../../features/scene/types/scene-state';
import { sceneMachine } from './sceneMachine';
import type { SceneMachineEvent } from './sceneMachine';

const acme = asCompanyId('acme');
const globex = asCompanyId('globex');

type SceneOutcome = { readonly state: SceneState; readonly visited: ReadonlyArray<CompanyId> };

const runFromInitial = (events: ReadonlyArray<SceneMachineEvent>): SceneOutcome => {
  const actor = createActor(sceneMachine).start();
  for (const event of events) {
    actor.send(event);
  }
  const context = actor.getSnapshot().context;
  actor.stop();
  return { state: context.scene, visited: context.visited };
};

describe('sceneMachine — initial state and `loading` exit', () => {
  it('starts in `{ kind: "loading" }`', () => {
    expect(runFromInitial([]).state).toEqual({ kind: 'loading' });
  });

  it('transitions from `loading` to `playing` on `start`', () => {
    expect(runFromInitial([{ type: 'start' }]).state).toEqual({ kind: 'playing' });
  });

  it('stays in `loading` on `pause_toggle`', () => {
    expect(runFromInitial([{ type: 'pause_toggle' }]).state).toEqual({ kind: 'loading' });
  });

  it('stays in `loading` on `interact`', () => {
    expect(runFromInitial([{ type: 'interact' }]).state).toEqual({ kind: 'loading' });
  });

  it('stays in `loading` on `entered_proximity { objectId }`', () => {
    expect(
      runFromInitial([{ type: 'entered_proximity', objectId: acme }]).state,
    ).toEqual({ kind: 'loading' });
  });

  it('stays in `loading` on `exited_proximity { objectId }`', () => {
    expect(
      runFromInitial([{ type: 'exited_proximity', objectId: acme }]).state,
    ).toEqual({ kind: 'loading' });
  });
});

describe('sceneMachine — proximity transitions', () => {
  it('transitions from `playing` to `revealing { objectId }` on `entered_proximity` carrying that id', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
      ]).state,
    ).toEqual({ kind: 'revealing', objectId: acme });
  });

  it('transitions from `revealing { objectId }` to `playing` on `exited_proximity` carrying the same id', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'exited_proximity', objectId: acme },
      ]).state,
    ).toEqual({ kind: 'playing' });
  });

  it('stays in `revealing { objectId }` on `exited_proximity` carrying a different id', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'exited_proximity', objectId: globex },
      ]).state,
    ).toEqual({ kind: 'revealing', objectId: acme });
  });

  it('stays in `playing` on `exited_proximity` (no-op when not revealing)', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'exited_proximity', objectId: acme },
      ]).state,
    ).toEqual({ kind: 'playing' });
  });

  it('switches to the newest id when `entered_proximity` arrives while already revealing a different id', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'entered_proximity', objectId: globex },
      ]).state,
    ).toEqual({ kind: 'revealing', objectId: globex });
  });

  it('is idempotent when `entered_proximity` re-fires for the same id already being revealed', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'entered_proximity', objectId: acme },
      ]).state,
    ).toEqual({ kind: 'revealing', objectId: acme });
  });
});

describe('sceneMachine — pause / resume round-trips', () => {
  it('transitions from `playing` to `paused { resumeTo: { kind: "playing" } }` on `pause_toggle`', () => {
    expect(
      runFromInitial([{ type: 'start' }, { type: 'pause_toggle' }]).state,
    ).toEqual({ kind: 'paused', resumeTo: { kind: 'playing' } });
  });

  it('transitions from `revealing { objectId }` to `paused { resumeTo: { kind: "revealing", objectId } }` on `pause_toggle`', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'pause_toggle' },
      ]).state,
    ).toEqual({
      kind: 'paused',
      resumeTo: { kind: 'revealing', objectId: acme },
    });
  });

  it('transitions from `paused { resumeTo: { kind: "playing" } }` to `playing` on `pause_toggle`', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'pause_toggle' },
        { type: 'pause_toggle' },
      ]).state,
    ).toEqual({ kind: 'playing' });
  });

  it('transitions from `paused { resumeTo: { kind: "revealing", objectId } }` to `revealing { objectId }` on `pause_toggle`', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'pause_toggle' },
        { type: 'pause_toggle' },
      ]).state,
    ).toEqual({ kind: 'revealing', objectId: acme });
  });

  it('preserves the original `objectId` across a `revealing → paused → revealing` round trip', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'pause_toggle' },
        { type: 'pause_toggle' },
      ]).state,
    ).toEqual({ kind: 'revealing', objectId: acme });
  });

  it('stays in `paused` on `entered_proximity { objectId }`', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'pause_toggle' },
        { type: 'entered_proximity', objectId: acme },
      ]).state,
    ).toEqual({ kind: 'paused', resumeTo: { kind: 'playing' } });
  });

  it('stays in `paused` on `exited_proximity { objectId }`', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'pause_toggle' },
        { type: 'exited_proximity', objectId: acme },
      ]).state,
    ).toEqual({ kind: 'paused', resumeTo: { kind: 'playing' } });
  });

  it('stays in `paused` on `interact`', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'pause_toggle' },
        { type: 'interact' },
      ]).state,
    ).toEqual({ kind: 'paused', resumeTo: { kind: 'playing' } });
  });

  it('stays in `paused` on `start`', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'pause_toggle' },
        { type: 'start' },
      ]).state,
    ).toEqual({ kind: 'paused', resumeTo: { kind: 'playing' } });
  });

  it('preserves the `revealing` `objectId` when `paused { resumeTo: revealing } + entered_proximity` is sent (paused suppresses all proximity)', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'pause_toggle' },
        { type: 'entered_proximity', objectId: globex },
        { type: 'pause_toggle' },
      ]).state,
    ).toEqual({ kind: 'revealing', objectId: acme });
  });
});

describe('sceneMachine — `playing` no-ops', () => {
  it('stays in `playing` on `interact` (no-op in foundations)', () => {
    expect(
      runFromInitial([{ type: 'start' }, { type: 'interact' }]).state,
    ).toEqual({ kind: 'playing' });
  });

  it('stays in `playing` on `start` (already started)', () => {
    expect(
      runFromInitial([{ type: 'start' }, { type: 'start' }]).state,
    ).toEqual({ kind: 'playing' });
  });
});

describe('sceneMachine — `revealing` no-ops', () => {
  it('stays in `revealing { objectId }` on `interact` (no-op in foundations)', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'interact' },
      ]).state,
    ).toEqual({ kind: 'revealing', objectId: acme });
  });

  it('stays in `revealing { objectId }` on `start`', () => {
    expect(
      runFromInitial([
        { type: 'start' },
        { type: 'entered_proximity', objectId: acme },
        { type: 'start' },
      ]).state,
    ).toEqual({ kind: 'revealing', objectId: acme });
  });
});

