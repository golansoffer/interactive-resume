import type { SceneState } from '../../../scene/types/scene-state';
import type { ProgressVisibility } from '../../types/progress-visibility';

export const projectVisibility = (state: SceneState): ProgressVisibility => {
  switch (state.kind) {
    case 'loading':
      return { kind: 'hidden' };
    case 'playing':
    case 'revealing':
    case 'paused':
      return { kind: 'visible' };
  }
};
