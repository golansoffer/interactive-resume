import type { JSX, RefObject } from 'react';
import { CommsDock } from '../../components/CommsDock/CommsDock';
import type { Kinematics } from '../../../scene/types/kinematics';
import type { SceneState } from '../../../scene/types/scene-state';
import { useCommsDock } from './useCommsDock';

type CommsDockWidgetProps = {
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly sceneState: SceneState;
};

export const CommsDockWidget = (props: CommsDockWidgetProps): JSX.Element => {
  const { channels, readout, visibility, motion, onActivate } = useCommsDock({
    kinematicsRef: props.kinematicsRef,
    sceneState: props.sceneState,
  });
  return (
    <CommsDock
      channels={channels}
      readout={readout}
      visibility={visibility}
      motion={motion}
      onActivate={onActivate}
    />
  );
};
