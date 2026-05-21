import type { CompanyId } from './company';

export type PlacedTarget = {
  readonly id: CompanyId;
  readonly placement: readonly [number, number, number];
};

export type RouteProjection =
  | { readonly kind: 'pre_route'; readonly firstTarget: PlacedTarget }
  | {
      readonly kind: 'mid_route';
      readonly anchor: PlacedTarget;
      readonly nextTarget: PlacedTarget;
    }
  | { readonly kind: 'complete'; readonly anchor: PlacedTarget };
