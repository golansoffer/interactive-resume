import type { JSX } from 'react';
import { Sparkles } from '@react-three/drei';

const COUNT = 40;
const SIZE = 2;
const NOISE = 1;
const SPEED = 0.3;

export const AmbientDust = (): JSX.Element => (
  <Sparkles
    count={COUNT}
    size={SIZE}
    scale={[120, 60, 120]}
    noise={NOISE}
    speed={SPEED}
  />
);
