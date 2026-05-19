import type { CSSProperties, JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '../../components/Scene/Scene';
import { useScene } from './useScene';

const CANVAS_WRAPPER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
};

export const SceneWidget = (): JSX.Element => {
  const { state, companies, intents, onEvent } = useScene();

  return (
    <Canvas style={CANVAS_WRAPPER_STYLE} dpr={[1, 2]}>
      <Scene
        state={state}
        companies={companies}
        intents={intents}
        onEvent={onEvent}
      />
    </Canvas>
  );
};
