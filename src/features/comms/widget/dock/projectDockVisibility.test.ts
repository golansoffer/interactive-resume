import { describe, expect, it } from 'vitest';
import type { SceneState } from '../../../scene/types/scene-state';
import { asCompanyId } from '../../../scene/types/company';
import { projectDockVisibility } from './projectDockVisibility';

describe('projectDockVisibility', () => {
  it('is kind "visible" when the scene state is kind "playing"', () => {
    const state: SceneState = { kind: 'playing' };
    expect(projectDockVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is kind "visible" when the scene state is kind "revealing"', () => {
    const state: SceneState = { kind: 'revealing', objectId: asCompanyId('mave') };
    expect(projectDockVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is kind "visible" when the scene state is kind "paused"', () => {
    const state: SceneState = {
      kind: 'paused',
      resumeTo: { kind: 'playing' },
    };
    expect(projectDockVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is kind "visible" when the scene state is paused and resumes to revealing', () => {
    const state: SceneState = {
      kind: 'paused',
      resumeTo: { kind: 'revealing', objectId: asCompanyId('riverside') },
    };
    expect(projectDockVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is kind "hidden" when the scene state is kind "loading"', () => {
    const state: SceneState = { kind: 'loading' };
    expect(projectDockVisibility(state)).toEqual({ kind: 'hidden' });
  });
});
