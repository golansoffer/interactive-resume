import type { Intent } from './intent';

export type KeyboardCommand =
  | { readonly kind: 'interact' }
  | { readonly kind: 'pause_toggle' };

export type KeyboardSignal =
  | { readonly kind: 'intent_down'; readonly intent: Intent['kind'] }
  | { readonly kind: 'intent_up'; readonly intent: Intent['kind'] }
  | { readonly kind: 'command'; readonly command: KeyboardCommand };
