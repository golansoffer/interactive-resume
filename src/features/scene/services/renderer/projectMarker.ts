import type { PlacedTarget, RouteProjection } from '../../types/route-projection';

export type ActiveTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'target'; readonly target: PlacedTarget };

export const targetFor = (projection: RouteProjection): ActiveTarget => {
  switch (projection.kind) {
    case 'complete':
      return { kind: 'none' };
    case 'pre_route':
      return { kind: 'target', target: projection.firstTarget };
    case 'mid_route':
      return { kind: 'target', target: projection.nextTarget };
  }
};
