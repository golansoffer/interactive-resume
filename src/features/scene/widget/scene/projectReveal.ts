import type { CompanyEntry, CompanyId } from '../../types/company';
import type { RevealProjection } from '../../types/reveal-projection';
import type { PausedResume, SceneState } from '../../types/scene-state';

export type { RevealProjection } from '../../types/reveal-projection';

const HIDDEN: RevealProjection = { kind: 'hidden' };

type ActiveReveal =
  | { readonly kind: 'none' }
  | { readonly kind: 'active'; readonly objectId: CompanyId };

const pausedActiveReveal = (resumeTo: PausedResume): ActiveReveal => {
  switch (resumeTo.kind) {
    case 'revealing':
      return { kind: 'active', objectId: resumeTo.objectId };
    case 'playing':
      return { kind: 'none' };
  }
};

const activeRevealOf = (state: SceneState): ActiveReveal => {
  switch (state.kind) {
    case 'revealing':
      return { kind: 'active', objectId: state.objectId };
    case 'paused':
      return pausedActiveReveal(state.resumeTo);
    case 'playing':
      return { kind: 'none' };
    case 'loading':
      return { kind: 'none' };
  }
};

export const projectReveal = (
  state: SceneState,
  entries: ReadonlyArray<CompanyEntry>,
): RevealProjection => {
  const active = activeRevealOf(state);
  switch (active.kind) {
    case 'none':
      return HIDDEN;
    case 'active':
      for (const entry of entries) {
        if (entry.id === active.objectId) {
          return {
            kind: 'visible',
            info: entry.info,
            assetId: entry.planet.assetId,
          };
        }
      }
      return HIDDEN;
  }
};
