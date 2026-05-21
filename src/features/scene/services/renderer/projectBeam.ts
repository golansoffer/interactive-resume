import type { RouteProjection } from '../../types/route-projection';

export type BeamCues =
  | { readonly kind: 'silent' }
  | {
      readonly kind: 'visible';
      readonly start: readonly [number, number, number];
      readonly end: readonly [number, number, number];
    };

export const cuesFor = (projection: RouteProjection): BeamCues => {
  switch (projection.kind) {
    case 'pre_route':
    case 'complete':
      return { kind: 'silent' };
    case 'mid_route':
      return {
        kind: 'visible',
        start: projection.anchor.placement,
        end: projection.nextTarget.placement,
      };
  }
};
