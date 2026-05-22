import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useActor } from '@xstate/react';
import { getSceneState, getVisited, sceneMachine } from '../../../../core/scene/sceneMachine';
import { CAREER_ROUTE, getCompanyEntries } from './companies';
import { FILLER_PLANETS } from './fillerPlanets';
import { projectReveal, type RevealProjection } from './projectReveal';
import { projectRoute } from './projectRoute';
import { useKeyboardIntents } from './useKeyboardIntents';
import { INITIAL_KINEMATICS, type Kinematics } from '../../types/kinematics';
import type { CompanyEntry } from '../../types/company';
import type { FillerPlanetEntry } from '../../types/filler-planet';
import type { IntentStream } from '../../types/intent';
import type { RouteProjection } from '../../types/route-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import { createBrowserSpaceshipAudio } from '../../../audio/services/createBrowserSpaceshipAudio';
import { useAudioSettings } from '../../../audio/widget/controls/useAudioSettings';
import type { SpaceshipAudio } from '../../../audio/types/audio-orchestrator';

const noop = (): void => {};

const NOOP_AUDIO: SpaceshipAudio = {
  setSceneAlive: noop,
  setBoost: noop,
  setMuted: noop,
  setVolume: noop,
  dispose: noop,
};

type UseSceneResult = {
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly fillerPlanets: ReadonlyArray<FillerPlanetEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly revealProjection: RevealProjection;
  readonly routeProjection: RouteProjection;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly audio: SpaceshipAudio;
};

export const useScene = (): UseSceneResult => {
  const [snapshot, send] = useActor(sceneMachine);
  const kinematicsRef = useRef<Kinematics>(INITIAL_KINEMATICS);
  const intents = useKeyboardIntents(send);
  const entries = useMemo<ReadonlyArray<CompanyEntry>>(() => getCompanyEntries(), []);
  const state = getSceneState(snapshot);
  const visited = getVisited(snapshot);
  const revealProjection = useMemo<RevealProjection>(
    () => projectReveal(state, entries),
    [state, entries],
  );
  const routeProjection = useMemo<RouteProjection>(
    () => projectRoute(visited, CAREER_ROUTE),
    [visited],
  );

  // The instance is constructed inside `useEffect` (not `useState` lazy init)
  // so React Strict Mode's mount→unmount→remount cycle re-creates a fresh
  // instance on the second mount instead of leaving the consumer with a
  // disposed one. NOOP_AUDIO seeds the state so consumers always see a
  // non-null `SpaceshipAudio` between the first paint and the first effect.
  const [audio, setAudio] = useState<SpaceshipAudio>(NOOP_AUDIO);

  useEffect(() => {
    const outcome = createBrowserSpaceshipAudio();
    const instance = outcome.kind === 'audio' ? outcome.audio : NOOP_AUDIO;
    setAudio(instance);
    return (): void => {
      instance.dispose();
      setAudio(NOOP_AUDIO);
    };
  }, []);

  const { settings: audioSettings } = useAudioSettings();
  const sceneAlive = state.kind === 'playing' || state.kind === 'revealing';

  useEffect(() => {
    audio.setSceneAlive(sceneAlive);
    if (!sceneAlive) audio.setBoost(0);
  }, [audio, sceneAlive]);

  useEffect(() => {
    audio.setMuted(audioSettings.muted);
    audio.setVolume('master', audioSettings.master);
    audio.setVolume('music', audioSettings.music);
    audio.setVolume('engine', audioSettings.engine);
    audio.setVolume('boost', audioSettings.boost);
  }, [audio, audioSettings]);

  useEffect(() => {
    send({ type: 'start' });
  }, [send]);

  const onEvent = useCallback(
    (event: SceneEvent): void => {
      switch (event.kind) {
        case 'entered_proximity':
          send({ type: 'entered_proximity', objectId: event.objectId });
          return;
        case 'exited_proximity':
          send({ type: 'exited_proximity', objectId: event.objectId });
      }
    },
    [send],
  );

  return {
    state,
    entries,
    fillerPlanets: FILLER_PLANETS,
    intents,
    onEvent,
    revealProjection,
    routeProjection,
    kinematicsRef,
    audio,
  };
};
