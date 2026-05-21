import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deviceSupportFromMatches,
  readDeviceSupport,
  subscribeDeviceSupport,
} from './deviceSupport';

type ChangeListener = (event: { readonly matches: boolean }) => void;

type FakeMediaQueryList = {
  matches: boolean;
  readonly addEventListener: (type: 'change', listener: ChangeListener) => void;
  readonly removeEventListener: (type: 'change', listener: ChangeListener) => void;
  readonly listenerCount: () => number;
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
    listenerCount: () => listeners.size,
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

describe('deviceSupportFromMatches — pure constructor', () => {
  it('returns the desktop variant when matches is true', () => {
    expect(deviceSupportFromMatches(true)).toEqual({ kind: 'desktop' });
  });

  it('returns the unsupported variant when matches is false', () => {
    expect(deviceSupportFromMatches(false)).toEqual({ kind: 'unsupported' });
  });

  it('returns referentially identical singletons across calls with the same input', () => {
    expect(deviceSupportFromMatches(true)).toBe(deviceSupportFromMatches(true));
    expect(deviceSupportFromMatches(false)).toBe(deviceSupportFromMatches(false));
  });
});

describe('readDeviceSupport — snapshot from matchMedia', () => {
  it('returns the desktop variant when the media query matches', () => {
    stubMatchMedia(createFakeMediaQueryList(true));
    expect(readDeviceSupport()).toEqual({ kind: 'desktop' });
  });

  it('returns the unsupported variant when the media query does not match', () => {
    stubMatchMedia(createFakeMediaQueryList(false));
    expect(readDeviceSupport()).toEqual({ kind: 'unsupported' });
  });

  it('falls back to the desktop variant when window.matchMedia is unavailable', () => {
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window, {
        matchMedia: 'not-a-function',
      }),
    );
    expect(readDeviceSupport()).toEqual({ kind: 'desktop' });
  });
});

describe('subscribeDeviceSupport — matchMedia listener lifecycle', () => {
  it('registers a change listener on the media query list', () => {
    const list = createFakeMediaQueryList(true);
    stubMatchMedia(list);
    const unsubscribe = subscribeDeviceSupport(() => {});
    expect(list.listenerCount()).toBe(1);
    unsubscribe();
  });

  it('unsubscribe removes the registered listener', () => {
    const list = createFakeMediaQueryList(true);
    stubMatchMedia(list);
    const unsubscribe = subscribeDeviceSupport(() => {});
    unsubscribe();
    expect(list.listenerCount()).toBe(0);
  });

  it('invokes onChange when the media query list emits a change', () => {
    const list = createFakeMediaQueryList(true);
    stubMatchMedia(list);
    const onChange = vi.fn();
    const unsubscribe = subscribeDeviceSupport(onChange);
    list.trigger(false);
    list.trigger(true);
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('returns a no-op unsubscribe when window.matchMedia is unavailable', () => {
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window, {
        matchMedia: 'not-a-function',
      }),
    );
    const onChange = vi.fn();
    const unsubscribe = subscribeDeviceSupport(onChange);
    expect(onChange).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });
});
