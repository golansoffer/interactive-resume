import type { JSX } from 'react';
import { Suspense } from 'react';
import { Environment } from '@react-three/drei';
import { DeepSpacePost } from './DeepSpacePost';
import { ShootingStars } from './ShootingStars';
import { StarsField } from './StarsField';

const HDR_PATH = '/textures/space.hdr';
const FALLBACK_COLOR = '#000010';

export const DeepSpace = (): JSX.Element => (
  <>
    <Suspense fallback={<color attach="background" args={[FALLBACK_COLOR]} />}>
      <Environment files={HDR_PATH} background="only" />
    </Suspense>
    <StarsField />
    <ShootingStars />
    <DeepSpacePost />
  </>
);
