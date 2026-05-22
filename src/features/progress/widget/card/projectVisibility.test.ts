import { describe, expect, it } from 'vitest';
import { asCompanyId } from '../../../scene/types/company';
import type { SceneState } from '../../../scene/types/scene-state';
import { projectVisibility } from './projectVisibility';

describe('projectVisibility', () => {
  it('is "visible" when scene is playing', () => {
    const state: SceneState = { kind: 'playing' };
    expect(projectVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is "visible" when scene is revealing', () => {
    const state: SceneState = { kind: 'revealing', objectId: asCompanyId('mave') };
    expect(projectVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is "visible" when scene is paused resuming to playing', () => {
    const state: SceneState = { kind: 'paused', resumeTo: { kind: 'playing' } };
    expect(projectVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is "visible" when scene is paused resuming to revealing', () => {
    const state: SceneState = {
      kind: 'paused',
      resumeTo: { kind: 'revealing', objectId: asCompanyId('riverside') },
    };
    expect(projectVisibility(state)).toEqual({ kind: 'visible' });
  });

  it('is "hidden" when scene is loading', () => {
    const state: SceneState = { kind: 'loading' };
    expect(projectVisibility(state)).toEqual({ kind: 'hidden' });
  });
});
