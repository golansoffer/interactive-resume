import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useActor } from '@xstate/react';
import { getSceneState, sceneMachine } from '../../../../core/scene/sceneMachine';
import { getFoundationCompanies } from './companies';
import { subscribeToKeyboard } from '../../services/input/subscribeToKeyboard';
import type { Company } from '../../types/company';
import type { Intent, IntentStream } from '../../types/intent';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';

type UseSceneResult = {
  readonly state: SceneState;
  readonly companies: ReadonlyArray<Company>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
};

export const useScene = (): UseSceneResult => {
  const [snapshot, send] = useActor(sceneMachine);

  const intentSetRef = useRef<Set<Intent['kind']>>(new Set());
  const intents = useMemo<IntentStream>(
    () => ({ current: intentSetRef.current }),
    [],
  );

  const companies = useMemo<ReadonlyArray<Company>>(
    () => getFoundationCompanies(),
    [],
  );

  useEffect(() => {
    const unsubscribe = subscribeToKeyboard((signal) => {
      switch (signal.kind) {
        case 'intent_down':
          intentSetRef.current.add(signal.intent);
          return;
        case 'intent_up':
          intentSetRef.current.delete(signal.intent);
          return;
        case 'command':
          if (signal.command.kind === 'interact') {
            console.log(signal.command);
          }
          send({ type: signal.command.kind });
      }
    });

    send({ type: 'start' });

    return unsubscribe;
  }, [send]);

  const onEvent = useCallback(
    (event: SceneEvent): void => {
      send({ type: event.kind, objectId: event.objectId });
      console.log(event);
    },
    [send],
  );

  const state = getSceneState(snapshot);

  return { state, companies, intents, onEvent };
};
