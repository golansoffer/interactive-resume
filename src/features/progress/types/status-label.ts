export type StatusLabel =
  | { readonly kind: 'standby' }
  | { readonly kind: 'active' }
  | { readonly kind: 'last_explored' }
  | { readonly kind: 'route_complete' };
