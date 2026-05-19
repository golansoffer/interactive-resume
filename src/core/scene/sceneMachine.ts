import { setup } from 'xstate';
import type { CompanyId } from '../../features/scene/types/company';
import type { SceneState } from '../../features/scene/types/scene-state';

export type SceneMachineEvent =
  | { readonly type: 'start' }
  | { readonly type: 'interact' }
  | { readonly type: 'pause_toggle' }
  | { readonly type: 'entered_proximity'; readonly objectId: CompanyId }
  | { readonly type: 'exited_proximity'; readonly objectId: CompanyId };

type SceneMachineContext = { readonly scene: SceneState };

const INITIAL_SCENE: SceneState = { kind: 'loading' };

const reduceOnStart = (scene: SceneState): SceneState => {
  switch (scene.kind) {
    case 'loading':
      return { kind: 'playing' };
    case 'playing':
    case 'revealing':
    case 'paused':
      return scene;
  }
};

const reduceOnEnteredProximity = (
  scene: SceneState,
  objectId: CompanyId,
): SceneState => {
  switch (scene.kind) {
    case 'playing':
      return { kind: 'revealing', objectId };
    case 'revealing':
      return { kind: 'revealing', objectId };
    case 'loading':
    case 'paused':
      return scene;
  }
};

const reduceOnExitedProximity = (
  scene: SceneState,
  objectId: CompanyId,
): SceneState => {
  switch (scene.kind) {
    case 'revealing':
      return scene.objectId === objectId ? { kind: 'playing' } : scene;
    case 'playing':
    case 'loading':
    case 'paused':
      return scene;
  }
};

const reduceOnPauseToggle = (scene: SceneState): SceneState => {
  switch (scene.kind) {
    case 'playing':
      return { kind: 'paused', resumeTo: { kind: 'playing' } };
    case 'revealing':
      return {
        kind: 'paused',
        resumeTo: { kind: 'revealing', objectId: scene.objectId },
      };
    case 'paused':
      return scene.resumeTo;
    case 'loading':
      return scene;
  }
};

const reduceOnInteract = (scene: SceneState): SceneState => scene;

const reduceScene = (
  scene: SceneState,
  event: SceneMachineEvent,
): SceneState => {
  switch (event.type) {
    case 'start':
      return reduceOnStart(scene);
    case 'entered_proximity':
      return reduceOnEnteredProximity(scene, event.objectId);
    case 'exited_proximity':
      return reduceOnExitedProximity(scene, event.objectId);
    case 'pause_toggle':
      return reduceOnPauseToggle(scene);
    case 'interact':
      return reduceOnInteract(scene);
  }
};

const machineSetup = setup({
  types: {
    context: {} as SceneMachineContext,
    events: {} as SceneMachineEvent,
  },
});

const reduceAction = machineSetup.assign({
  scene: ({ context, event }) => reduceScene(context.scene, event),
});

export const sceneMachine = machineSetup.createMachine({
  id: 'scene',
  context: { scene: INITIAL_SCENE },
  initial: 'active',
  states: {
    active: {
      on: {
        start: { actions: reduceAction },
        entered_proximity: { actions: reduceAction },
        exited_proximity: { actions: reduceAction },
        pause_toggle: { actions: reduceAction },
        interact: { actions: reduceAction },
      },
    },
  },
});

type SceneMachineSnapshot = { readonly context: SceneMachineContext };

export const getSceneState = (snapshot: SceneMachineSnapshot): SceneState =>
  snapshot.context.scene;
