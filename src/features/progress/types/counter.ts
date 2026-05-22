export type Counter =
  | { readonly kind: 'idle'; readonly visited: number; readonly total: number }
  | { readonly kind: 'complete'; readonly total: number };
