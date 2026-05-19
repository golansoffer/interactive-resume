export type Intent =
  | { readonly kind: 'thrust_forward' }
  | { readonly kind: 'thrust_backward' }
  | { readonly kind: 'turn_left' }
  | { readonly kind: 'turn_right' }
  | { readonly kind: 'brake' };

export type IntentStream = {
  readonly current: ReadonlySet<Intent['kind']>;
};
