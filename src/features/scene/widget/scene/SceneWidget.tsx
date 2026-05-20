import type { CSSProperties, JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '../../components/Scene/Scene';
import { CompanyInfoPanel } from '../../components/CompanyInfoPanel/CompanyInfoPanel';
import type { ShipEntry } from '../../../ships/types/ship';
import { useScene } from './useScene';

const CANVAS_WRAPPER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
};

type SceneWidgetProps = {
  readonly ship: ShipEntry;
};

export const SceneWidget = (props: SceneWidgetProps): JSX.Element => {
  const { state, entries, intents, onEvent, revealProjection } = useScene();

  return (
    <>
      <Canvas style={CANVAS_WRAPPER_STYLE} dpr={[1, 2]}>
        <Scene
          ship={props.ship}
          state={state}
          entries={entries}
          intents={intents}
          onEvent={onEvent}
        />
      </Canvas>
      <CompanyInfoPanel projection={revealProjection} />
    </>
  );
};
