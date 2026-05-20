import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useActor } from '@xstate/react';
import { getSceneState, sceneMachine } from '../../../../core/scene/sceneMachine';
import { getCompanyEntries } from './companies';
import { subscribeToKeyboard } from '../../services/input/subscribeToKeyboard';
import type { CompanyEntry, CompanyId } from '../../types/company';
import type { Intent, IntentStream } from '../../types/intent';
import type { RevealProjection } from '../../types/reveal-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { PausedResume, SceneState } from '../../types/scene-state';

type UseSceneResult = {
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly revealProjection: RevealProjection;
};

const HIDDEN: RevealProjection = { kind: 'hidden' };

type ActiveReveal =
  | { readonly kind: 'none' }
  | { readonly kind: 'active'; readonly objectId: CompanyId };

const pausedActiveReveal = (resumeTo: PausedResume): ActiveReveal => {
  switch (resumeTo.kind) {
    case 'revealing':
      return { kind: 'active', objectId: resumeTo.objectId };
    case 'playing':
      return { kind: 'none' };
  }
};

const activeRevealOf = (state: SceneState): ActiveReveal => {
  switch (state.kind) {
    case 'revealing':
      return { kind: 'active', objectId: state.objectId };
    case 'paused':
      return pausedActiveReveal(state.resumeTo);
    case 'playing':
      return { kind: 'none' };
    case 'loading':
      return { kind: 'none' };
  }
};

const projectReveal = (
  state: SceneState,
  entries: ReadonlyArray<CompanyEntry>,
): RevealProjection => {
  const active = activeRevealOf(state);
  switch (active.kind) {
    case 'none':
      return HIDDEN;
    case 'active':
      for (const entry of entries) {
        if (entry.id === active.objectId) {
          return {
            kind: 'visible',
            info: entry.info,
            assetId: entry.planet.assetId,
          };
        }
      }
      return HIDDEN;
  }
};

export const useScene = (): UseSceneResult => {
  const [snapshot, send] = useActor(sceneMachine);
  const intentSetRef = useRef<Set<Intent['kind']>>(new Set());
  const intents = useMemo<IntentStream>(() => ({ current: intentSetRef.current }), []);
  const entries = useMemo<ReadonlyArray<CompanyEntry>>(() => getCompanyEntries(), []);
  const state = getSceneState(snapshot);
  const revealProjection = useMemo<RevealProjection>(
    () => projectReveal(state, entries),
    [state, entries],
  );

  useEffect(() => {
    const unsubscribe = subscribeToKeyboard((signal) => {
      switch (signal.kind) {
        case 'intent_down': intentSetRef.current.add(signal.intent); return;
        case 'intent_up': intentSetRef.current.delete(signal.intent); return;
        case 'command': send({ type: signal.command.kind });
      }
    });
    send({ type: 'start' });
    return unsubscribe;
  }, [send]);

  const onEvent = useCallback(
    (event: SceneEvent): void => {
      send({ type: event.kind, objectId: event.objectId });
    },
    [send],
  );

  return { state, entries, intents, onEvent, revealProjection };
};
