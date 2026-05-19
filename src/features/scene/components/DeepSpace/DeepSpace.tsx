import type { JSX, ReactNode } from 'react';
import { Component, Suspense } from 'react';
import { Environment } from '@react-three/drei';
import { DeepSpacePost } from './DeepSpacePost';
import { ShootingStars } from './ShootingStars';
import { StarsField } from './StarsField';

const HDR_PATH = '/textures/space.jpg';
const FALLBACK_COLOR = '#000010';

type BoundaryState = { readonly failed: boolean };

class EnvironmentBoundary extends Component<{ readonly children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export const DeepSpace = (): JSX.Element => (
  <>
    <color attach="background" args={[FALLBACK_COLOR]} />
    <EnvironmentBoundary>
      <Suspense fallback={null}>
        <Environment files={HDR_PATH} background="only" resolution={2048} />
      </Suspense>
    </EnvironmentBoundary>
    <StarsField />
    <ShootingStars />
    <DeepSpacePost />
  </>
);
