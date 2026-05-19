import type { Intent } from '../../types/intent';
import type { KeyboardCommand, KeyboardSignal } from '../../types/keyboard-signal';

type KeyClassification =
  | { readonly kind: 'continuous'; readonly intent: Intent['kind'] }
  | { readonly kind: 'discrete'; readonly command: KeyboardCommand }
  | { readonly kind: 'unmapped' };

const classify = (code: string): KeyClassification => {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      return { kind: 'continuous', intent: 'thrust_forward' };
    case 'KeyS':
    case 'ArrowDown':
      return { kind: 'continuous', intent: 'thrust_backward' };
    case 'KeyA':
    case 'ArrowLeft':
      return { kind: 'continuous', intent: 'turn_left' };
    case 'KeyD':
    case 'ArrowRight':
      return { kind: 'continuous', intent: 'turn_right' };
    case 'Space':
      return { kind: 'continuous', intent: 'brake' };
    case 'KeyE':
      return { kind: 'discrete', command: { kind: 'interact' } };
    case 'Escape':
      return { kind: 'discrete', command: { kind: 'pause_toggle' } };
    default:
      return { kind: 'unmapped' };
  }
};

const hasModifier = (event: KeyboardEvent): boolean =>
  event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;

export const subscribeToKeyboard = (
  onSignal: (signal: KeyboardSignal) => void,
  target: EventTarget = window,
): (() => void) => {
  const held = new Set<string>();

  const handleKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    if (hasModifier(event)) return;
    const classified = classify(event.code);
    if (classified.kind === 'unmapped') return;
    if (held.has(event.code)) return;
    held.add(event.code);
    if (classified.kind === 'continuous') {
      onSignal({ kind: 'intent_down', intent: classified.intent });
      return;
    }
    onSignal({ kind: 'command', command: classified.command });
  };

  const handleKeyUp = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    const classified = classify(event.code);
    if (classified.kind === 'unmapped') return;
    if (!held.has(event.code)) return;
    held.delete(event.code);
    if (classified.kind === 'continuous') {
      onSignal({ kind: 'intent_up', intent: classified.intent });
    }
  };

  target.addEventListener('keydown', handleKeyDown);
  target.addEventListener('keyup', handleKeyUp);

  return (): void => {
    target.removeEventListener('keydown', handleKeyDown);
    target.removeEventListener('keyup', handleKeyUp);
  };
};
