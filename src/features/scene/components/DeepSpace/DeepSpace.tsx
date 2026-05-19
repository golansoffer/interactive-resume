import type { JSX, ReactNode } from 'react';
import { Component, Suspense, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { DeepSpacePost } from './DeepSpacePost';
import { ShootingStars } from './ShootingStars';
import { SkyTexture } from './SkyTexture';
import { StarsField } from './StarsField';

const SKY_PATH = '/textures/space.jpg';
const FALLBACK_COLOR = '#04050a';

type BoundaryState = { readonly failed: boolean };

class SkyBoundary extends Component<{ readonly children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const Anchor = (props: { readonly children: ReactNode }): JSX.Element => {
  const camera = useThree((s) => s.camera);
  const ref = useRef<Group>(null);

  useFrame(() => {
    const g = ref.current;
    if (g === null) return;
    g.position.copy(camera.position);
  }, 1);

  return <group ref={ref}>{props.children}</group>;
};

export const DeepSpace = (): JSX.Element => (
  <>
    <color attach="background" args={[FALLBACK_COLOR]} />
    <SkyBoundary>
      <Suspense fallback={null}>
        <SkyTexture path={SKY_PATH} />
      </Suspense>
    </SkyBoundary>
    <Anchor>
      <StarsField />
      <ShootingStars />
    </Anchor>
    <DeepSpacePost />
  </>
);
