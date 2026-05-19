import type { JSX } from 'react';
import { Stars } from '@react-three/drei';

const RADIUS = 380;
const DEPTH = 60;
const COUNT = 3500;
const FACTOR = 4;
const SATURATION = 0.4;

export const StarsField = (): JSX.Element => (
  <Stars
    radius={RADIUS}
    depth={DEPTH}
    count={COUNT}
    factor={FACTOR}
    saturation={SATURATION}
    speed={0}
    fade
  />
);
