export type MotionPreference = { readonly kind: 'normal' } | { readonly kind: 'reduced' };

export const motionPreferenceFromMatches = (matches: boolean): MotionPreference =>
  matches ? { kind: 'reduced' } : { kind: 'normal' };
