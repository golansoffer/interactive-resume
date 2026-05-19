import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActor } from '@xstate/react';
import { getSceneState, sceneMachine } from '../../../../core/scene/sceneMachine';
import { getCompanyEntries } from './companies';
import { subscribeToKeyboard } from '../../services/input/subscribeToKeyboard';
import type { CompanyEntry } from '../../types/company';
import type { Intent, IntentStream } from '../../types/intent';
import type { RevealProjection } from '../../types/reveal-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';

type UseSceneResult = {
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly revealProjection: RevealProjection;
};

const HIDDEN: RevealProjection = { kind: 'hidden' };

const projectionForEvent = (event: SceneEvent): RevealProjection => {
  switch (event.kind) {
    case 'entered_proximity':
      return { kind: 'visible', info: event.info, placement: event.placement };
    case 'exited_proximity':
      return HIDDEN;
  }
};

export const useScene = (): UseSceneResult => {
  const [snapshot, send] = useActor(sceneMachine);
  const intentSetRef = useRef<Set<Intent['kind']>>(new Set());
  const intents = useMemo<IntentStream>(() => ({ current: intentSetRef.current }), []);
  const entries = useMemo<ReadonlyArray<CompanyEntry>>(() => getCompanyEntries(), []);
  const [revealProjection, setRevealProjection] = useState<RevealProjection>(HIDDEN);

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
      setRevealProjection(projectionForEvent(event));
      send({ type: event.kind, objectId: event.objectId });
    },
    [send],
  );

  return { state: getSceneState(snapshot), entries, intents, onEvent, revealProjection };
};
