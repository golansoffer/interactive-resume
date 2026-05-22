import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Intent } from '../../types/intent';
import type { KeyboardSignal } from '../../types/keyboard-signal';
import { subscribeToKeyboard } from './subscribeToKeyboard';

type EventInit = {
  readonly code: string;
  readonly key?: string;
  readonly repeat?: boolean;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
};

const keyDownEvent = (init: EventInit): KeyboardEvent =>
  new KeyboardEvent('keydown', {
    code: init.code,
    key: init.key ?? init.code,
    repeat: init.repeat ?? false,
    shiftKey: init.shiftKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    altKey: init.altKey ?? false,
    metaKey: init.metaKey ?? false,
    bubbles: true,
  });

const keyUpEvent = (init: EventInit): KeyboardEvent =>
  new KeyboardEvent('keyup', {
    code: init.code,
    key: init.key ?? init.code,
    repeat: init.repeat ?? false,
    shiftKey: init.shiftKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    altKey: init.altKey ?? false,
    metaKey: init.metaKey ?? false,
    bubbles: true,
  });

describe('subscribeToKeyboard', () => {
  let target: EventTarget;
  let onSignal: ReturnType<typeof vi.fn<(signal: KeyboardSignal) => void>>;
  let unsubscribe: () => void;

  beforeEach(() => {
    target = document.createElement('div');
    onSignal = vi.fn<(signal: KeyboardSignal) => void>();
    unsubscribe = subscribeToKeyboard(onSignal, target);
  });

  afterEach(() => {
    unsubscribe();
  });

  describe('attachment lifecycle', () => {
    it('does not invoke onSignal when attached with no key events fired', () => {
      expect(onSignal).not.toHaveBeenCalled();
    });

    it('stops invoking onSignal after the returned unsubscribe function is called', () => {
      unsubscribe();
      target.dispatchEvent(keyDownEvent({ code: 'KeyW' }));
      target.dispatchEvent(keyUpEvent({ code: 'KeyW' }));
      expect(onSignal).not.toHaveBeenCalled();
    });
  });

  describe('continuous keys — intent_down on press', () => {
    const cases: ReadonlyArray<{ code: string; intent: Intent['kind'] }> = [
      { code: 'KeyW', intent: 'move_forward' },
      { code: 'ArrowUp', intent: 'move_forward' },
      { code: 'KeyS', intent: 'move_backward' },
      { code: 'ArrowDown', intent: 'move_backward' },
      { code: 'KeyA', intent: 'strafe_left' },
      { code: 'ArrowLeft', intent: 'strafe_left' },
      { code: 'KeyD', intent: 'strafe_right' },
      { code: 'ArrowRight', intent: 'strafe_right' },
      { code: 'Space', intent: 'boost' },
    ];

    cases.forEach(({ code, intent }) => {
      it(`invokes onSignal with { kind: 'intent_down', intent: '${intent}' } when ${code} is pressed`, () => {
        target.dispatchEvent(keyDownEvent({ code }));
        expect(onSignal).toHaveBeenCalledTimes(1);
        expect(onSignal).toHaveBeenCalledWith({ kind: 'intent_down', intent });
      });
    });
  });

  describe('continuous keys — intent_up on release', () => {
    const cases: ReadonlyArray<{ code: string; intent: Intent['kind'] }> = [
      { code: 'KeyW', intent: 'move_forward' },
      { code: 'ArrowUp', intent: 'move_forward' },
      { code: 'KeyS', intent: 'move_backward' },
      { code: 'ArrowDown', intent: 'move_backward' },
      { code: 'KeyA', intent: 'strafe_left' },
      { code: 'ArrowLeft', intent: 'strafe_left' },
      { code: 'KeyD', intent: 'strafe_right' },
      { code: 'ArrowRight', intent: 'strafe_right' },
      { code: 'Space', intent: 'boost' },
    ];

    cases.forEach(({ code, intent }) => {
      it(`invokes onSignal with { kind: 'intent_up', intent: '${intent}' } when ${code} is released`, () => {
        target.dispatchEvent(keyDownEvent({ code }));
        onSignal.mockClear();
        target.dispatchEvent(keyUpEvent({ code }));
        expect(onSignal).toHaveBeenCalledTimes(1);
        expect(onSignal).toHaveBeenCalledWith({ kind: 'intent_up', intent });
      });
    });
  });

  describe('continuous keys — auto-repeat behavior', () => {
    it('invokes onSignal only once with intent_down for W when a keydown is followed by OS auto-repeat keydown events for the same key', () => {
      target.dispatchEvent(keyDownEvent({ code: 'KeyW' }));
      target.dispatchEvent(keyDownEvent({ code: 'KeyW', repeat: true }));
      target.dispatchEvent(keyDownEvent({ code: 'KeyW', repeat: true }));
      const downCalls = onSignal.mock.calls.filter(
        ([signal]) => signal.kind === 'intent_down' && signal.intent === 'move_forward',
      );
      expect(downCalls).toHaveLength(1);
    });

    it('invokes onSignal with intent_down for W again after a release-then-press cycle (auto-repeat suppression is per-hold, not lifetime)', () => {
      target.dispatchEvent(keyDownEvent({ code: 'KeyW' }));
      target.dispatchEvent(keyUpEvent({ code: 'KeyW' }));
      onSignal.mockClear();
      target.dispatchEvent(keyDownEvent({ code: 'KeyW' }));
      expect(onSignal).toHaveBeenCalledWith({ kind: 'intent_down', intent: 'move_forward' });
    });
  });

  describe('Space — boost intent', () => {
    it("invokes onSignal with { kind: 'intent_down', intent: 'boost' } when Space is pressed", () => {
      target.dispatchEvent(keyDownEvent({ code: 'Space' }));
      expect(onSignal).toHaveBeenCalledTimes(1);
      expect(onSignal).toHaveBeenCalledWith({ kind: 'intent_down', intent: 'boost' });
    });

    it("invokes onSignal with { kind: 'intent_up', intent: 'boost' } when Space is released", () => {
      target.dispatchEvent(keyDownEvent({ code: 'Space' }));
      onSignal.mockClear();
      target.dispatchEvent(keyUpEvent({ code: 'Space' }));
      expect(onSignal).toHaveBeenCalledTimes(1);
      expect(onSignal).toHaveBeenCalledWith({ kind: 'intent_up', intent: 'boost' });
    });

    it('invokes onSignal only once with intent_down for Space when keydown is followed by OS auto-repeat keydown events', () => {
      target.dispatchEvent(keyDownEvent({ code: 'Space' }));
      target.dispatchEvent(keyDownEvent({ code: 'Space', repeat: true }));
      target.dispatchEvent(keyDownEvent({ code: 'Space', repeat: true }));
      const downCalls = onSignal.mock.calls.filter(
        ([signal]) => signal.kind === 'intent_down' && signal.intent === 'boost',
      );
      expect(downCalls).toHaveLength(1);
    });

    it('does not invoke onSignal when Shift+Space is pressed (modifier-key chord)', () => {
      target.dispatchEvent(keyDownEvent({ code: 'Space', shiftKey: true }));
      expect(onSignal).not.toHaveBeenCalled();
    });
  });

  describe('discrete commands — command on press only', () => {
    it("invokes onSignal with { kind: 'command', command: { kind: 'interact' } } when E is pressed", () => {
      target.dispatchEvent(keyDownEvent({ code: 'KeyE' }));
      expect(onSignal).toHaveBeenCalledTimes(1);
      expect(onSignal).toHaveBeenCalledWith({
        kind: 'command',
        command: { kind: 'interact' },
      });
    });

    it("does not invoke onSignal for E's keyup event", () => {
      target.dispatchEvent(keyDownEvent({ code: 'KeyE' }));
      onSignal.mockClear();
      target.dispatchEvent(keyUpEvent({ code: 'KeyE' }));
      expect(onSignal).not.toHaveBeenCalled();
    });

    it('invokes onSignal only once with interact when E keydown is followed by OS auto-repeat keydown events', () => {
      target.dispatchEvent(keyDownEvent({ code: 'KeyE' }));
      target.dispatchEvent(keyDownEvent({ code: 'KeyE', repeat: true }));
      target.dispatchEvent(keyDownEvent({ code: 'KeyE', repeat: true }));
      const interactCalls = onSignal.mock.calls.filter(
        ([signal]) =>
          signal.kind === 'command' && signal.command.kind === 'interact',
      );
      expect(interactCalls).toHaveLength(1);
    });

    it('invokes onSignal with interact again after E is released and re-pressed', () => {
      target.dispatchEvent(keyDownEvent({ code: 'KeyE' }));
      target.dispatchEvent(keyUpEvent({ code: 'KeyE' }));
      onSignal.mockClear();
      target.dispatchEvent(keyDownEvent({ code: 'KeyE' }));
      expect(onSignal).toHaveBeenCalledWith({
        kind: 'command',
        command: { kind: 'interact' },
      });
    });
  });

  describe('unmapped keys', () => {
    it('does not invoke onSignal when an unmapped key (e.g. Q, Shift, Tab) is pressed or released', () => {
      target.dispatchEvent(keyDownEvent({ code: 'KeyQ' }));
      target.dispatchEvent(keyUpEvent({ code: 'KeyQ' }));
      target.dispatchEvent(keyDownEvent({ code: 'ShiftLeft' }));
      target.dispatchEvent(keyUpEvent({ code: 'ShiftLeft' }));
      target.dispatchEvent(keyDownEvent({ code: 'Tab' }));
      target.dispatchEvent(keyUpEvent({ code: 'Tab' }));
      expect(onSignal).not.toHaveBeenCalled();
    });
  });
});
