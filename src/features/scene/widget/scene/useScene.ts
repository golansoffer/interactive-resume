import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useActor } from '@xstate/react';
import { getSceneState, sceneMachine } from '../../../../core/scene/sceneMachine';
import { getCompanyEntries } from './companies';
import { projectReveal, type RevealProjection } from './projectReveal';
import { useKeyboardIntents } from './useKeyboardIntents';
import { INITIAL_KINEMATICS, type Kinematics } from '../../types/kinematics';
import type { CompanyEntry } from '../../types/company';
import type { IntentStream } from '../../types/intent';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';

type UseSceneResult = {
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly revealProjection: RevealProjection;
  readonly kinematicsRef: RefObject<Kinematics>;
};

export const useScene = (): UseSceneResult => {
  const [snapshot, send] = useActor(sceneMachine);
  const kinematicsRef = useRef<Kinematics>(INITIAL_KINEMATICS);
  const intents = useKeyboardIntents(send);
  const entries = useMemo<ReadonlyArray<CompanyEntry>>(() => getCompanyEntries(), []);
  const state = getSceneState(snapshot);
  const revealProjection = useMemo<RevealProjection>(
    () => projectReveal(state, entries),
    [state, entries],
  );

  useEffect(() => {
    send({ type: 'start' });
  }, [send]);

  const onEvent = useCallback(
    (event: SceneEvent): void => {
      send({ type: event.kind, objectId: event.objectId });
    },
    [send],
  );

  return { state, entries, intents, onEvent, revealProjection, kinematicsRef };
};
