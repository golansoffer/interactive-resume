import type { JSX } from 'react';
import { Sparkles } from '@react-three/drei';

const COUNT = 80;
const SIZE = 4;
const NOISE = 1;
const SPEED = 0.4;

export const AmbientDust = (): JSX.Element => (
  <Sparkles
    count={COUNT}
    size={SIZE}
    scale={[40, 20, 40]}
    noise={NOISE}
    speed={SPEED}
  />
);
