import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

type MockScene = {
  readonly placeholder: true;
  readonly clone: () => MockScene;
  readonly traverse: (callback: (obj: unknown) => void) => void;
};

const mockScene: MockScene = {
  placeholder: true,
  clone: (): MockScene => mockScene,
  traverse: (): void => {
    // no children in the mock; the callback is intentionally not invoked
  },
};

type MockTexture = {
  magFilter: number;
  minFilter: number;
  colorSpace: string;
  needsUpdate: boolean;
};

const mockTexture: MockTexture = {
  magFilter: 0,
  minFilter: 0,
  colorSpace: '',
  needsUpdate: false,
};

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(
    (): { readonly scene: MockScene } => ({ scene: mockScene }),
    { preload: (): void => {} },
  ),
  useTexture: Object.assign(
    (): MockTexture => mockTexture,
    { preload: (): void => {} },
  ),
}));

import { usePlanetVisual } from './usePlanetVisual';

describe('usePlanetVisual', () => {
  it('returns an object with plan, pose, and extraction defined for a valid asset id', () => {
    const { result } = renderHook(() => usePlanetVisual('moon_a', 0));
    expect(result.current.plan).toBeDefined();
    expect(result.current.pose).toBeDefined();
    expect(result.current.extraction).toBeDefined();
  });

  it('returns the same plan reference across re-renders when assetId and phase are unchanged (memoization holds)', () => {
    const { result, rerender } = renderHook(
      ({ assetId, phase }: { assetId: 'moon_a'; phase: number }) =>
        usePlanetVisual(assetId, phase),
      { initialProps: { assetId: 'moon_a' as const, phase: 0 } },
    );
    const firstPlan = result.current.plan;
    rerender({ assetId: 'moon_a' as const, phase: 0 });
    expect(result.current.plan).toBe(firstPlan);
  });

  it('returns the same pose reference across re-renders when assetId and phase are unchanged (memoization holds)', () => {
    const { result, rerender } = renderHook(
      ({ assetId, phase }: { assetId: 'moon_a'; phase: number }) =>
        usePlanetVisual(assetId, phase),
      { initialProps: { assetId: 'moon_a' as const, phase: 0 } },
    );
    const firstPose = result.current.pose;
    rerender({ assetId: 'moon_a' as const, phase: 0 });
    expect(result.current.pose).toBe(firstPose);
  });

  it('returns the same extraction reference across re-renders when assetId and phase are unchanged (memoization holds)', () => {
    const { result, rerender } = renderHook(
      ({ assetId, phase }: { assetId: 'moon_a'; phase: number }) =>
        usePlanetVisual(assetId, phase),
      { initialProps: { assetId: 'moon_a' as const, phase: 0 } },
    );
    const firstExtraction = result.current.extraction;
    rerender({ assetId: 'moon_a' as const, phase: 0 });
    expect(result.current.extraction).toBe(firstExtraction);
  });
});
