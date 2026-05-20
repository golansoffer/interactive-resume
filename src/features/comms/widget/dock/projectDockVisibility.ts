import type { SceneState } from '../../../scene/types/scene-state';
import type { DockVisibility } from '../../types/visibility';

export const projectDockVisibility = (sceneState: SceneState): DockVisibility => {
  switch (sceneState.kind) {
    case 'loading':
      return { kind: 'hidden' };
    case 'playing':
    case 'revealing':
    case 'paused':
      return { kind: 'visible' };
  }
};
