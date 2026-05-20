import { useEffect, useMemo, useRef } from 'react';
import { subscribeToKeyboard } from '../../services/input/subscribeToKeyboard';
import type { Intent, IntentStream } from '../../types/intent';
import type { KeyboardCommand } from '../../types/keyboard-signal';

export type CommandSender = (event: { readonly type: KeyboardCommand['kind'] }) => void;

export const useKeyboardIntents = (sendCommand: CommandSender): IntentStream => {
  const intentSetRef = useRef<Set<Intent['kind']>>(new Set());
  const intents = useMemo<IntentStream>(() => ({ current: intentSetRef.current }), []);

  useEffect(() => {
    const unsubscribe = subscribeToKeyboard((signal) => {
      switch (signal.kind) {
        case 'intent_down':
          intentSetRef.current.add(signal.intent);
          return;
        case 'intent_up':
          intentSetRef.current.delete(signal.intent);
          return;
        case 'command':
          sendCommand({ type: signal.command.kind });
      }
    });
    return unsubscribe;
  }, [sendCommand]);

  return intents;
};
