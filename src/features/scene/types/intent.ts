export type Intent =
  | { readonly kind: 'move_forward' }
  | { readonly kind: 'move_backward' }
  | { readonly kind: 'strafe_left' }
  | { readonly kind: 'strafe_right' }
  | { readonly kind: 'boost' };

export type IntentStream = {
  readonly current: ReadonlySet<Intent['kind']>;
};
