type JsdomWindow = { readonly localStorage: Storage; readonly sessionStorage: Storage };
type JsdomHost = { readonly jsdom: { readonly window: JsdomWindow } };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isJsdomHost = (value: unknown): value is JsdomHost => {
  if (!isRecord(value)) return false;
  const jsdom = value['jsdom'];
  if (!isRecord(jsdom)) return false;
  const window = jsdom['window'];
  return isRecord(window) && 'localStorage' in window && 'sessionStorage' in window;
};

const parseJsdomHost = (value: unknown): JsdomHost => {
  if (!isJsdomHost(value)) {
    throw new Error('test-setup expects vitest jsdom environment');
  }
  return value;
};

const jsdomWindow = parseJsdomHost(globalThis).jsdom.window;

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get: () => jsdomWindow.localStorage,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  get: () => jsdomWindow.sessionStorage,
});
