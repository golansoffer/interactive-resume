import type { CompanyId } from './company';

export type PausedResume =
  | { readonly kind: 'playing' }
  | { readonly kind: 'revealing'; readonly objectId: CompanyId };

export type SceneState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'playing' }
  | { readonly kind: 'revealing'; readonly objectId: CompanyId }
  | { readonly kind: 'paused'; readonly resumeTo: PausedResume };
