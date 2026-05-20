import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribePrefersReducedMotion } from './prefersReducedMotion';

type ChangeListener = (event: { readonly matches: boolean }) => void;

type FakeMediaQueryList = {
  matches: boolean;
  readonly addEventListener: (type: 'change', listener: ChangeListener) => void;
  readonly removeEventListener: (type: 'change', listener: ChangeListener) => void;
  trigger: (matches: boolean) => void;
};

const createFakeMediaQueryList = (initialMatches: boolean): FakeMediaQueryList => {
  const listeners = new Set<ChangeListener>();
  const list: FakeMediaQueryList = {
    matches: initialMatches,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    trigger: (matches: boolean) => {
      list.matches = matches;
      for (const listener of listeners) {
        listener({ matches });
      }
    },
  };
  return list;
};

const stubMatchMedia = (list: FakeMediaQueryList) => {
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window, {
      matchMedia: vi.fn(() => list),
    }),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('subscribePrefersReducedMotion — matchMedia available', () => {
  it('calls back immediately with kind "normal" when the query does not match', () => {
    const list = createFakeMediaQueryList(false);
    stubMatchMedia(list);
    const onChange = vi.fn();
    const unsubscribe = subscribePrefersReducedMotion(onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ kind: 'normal' });
    unsubscribe();
  });

  it('calls back immediately with kind "reduced" when the query matches', () => {
    const list = createFakeMediaQueryList(true);
    stubMatchMedia(list);
    const onChange = vi.fn();
    const unsubscribe = subscribePrefersReducedMotion(onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ kind: 'reduced' });
    unsubscribe();
  });

  it('emits a parsed preference on each change event', () => {
    const list = createFakeMediaQueryList(false);
    stubMatchMedia(list);
    const onChange = vi.fn();
    const unsubscribe = subscribePrefersReducedMotion(onChange);
    list.trigger(true);
    list.trigger(false);
    expect(onChange.mock.calls).toEqual([
      [{ kind: 'normal' }],
      [{ kind: 'reduced' }],
      [{ kind: 'normal' }],
    ]);
    unsubscribe();
  });

  it('unsubscribe stops further change notifications', () => {
    const list = createFakeMediaQueryList(false);
    stubMatchMedia(list);
    const onChange = vi.fn();
    const unsubscribe = subscribePrefersReducedMotion(onChange);
    onChange.mockClear();
    unsubscribe();
    list.trigger(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('subscribePrefersReducedMotion — SSR / non-window environment', () => {
  it('calls back once with kind "normal" and returns a no-op unsubscribe when window is missing', () => {
    const originalWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');
    try {
      const onChange = vi.fn();
      const unsubscribe = subscribePrefersReducedMotion(onChange);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ kind: 'normal' });
      expect(() => unsubscribe()).not.toThrow();
    } finally {
      Reflect.set(globalThis, 'window', originalWindow);
    }
  });

  it('calls back once with kind "normal" when matchMedia is not a function', () => {
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window, {
        matchMedia: 'not-a-function',
      }),
    );
    const onChange = vi.fn();
    const unsubscribe = subscribePrefersReducedMotion(onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ kind: 'normal' });
    unsubscribe();
  });
});
