import type { CSSProperties, JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '../../components/Scene/Scene';
import { useScene } from './useScene';

const CANVAS_WRAPPER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
};

export const SceneWidget = (): JSX.Element => {
  const { state, entries, intents, onEvent, revealProjection } = useScene();

  return (
    <Canvas style={CANVAS_WRAPPER_STYLE} dpr={[1, 2]}>
      <Scene
        state={state}
        entries={entries}
        intents={intents}
        onEvent={onEvent}
        revealProjection={revealProjection}
      />
    </Canvas>
  );
};
