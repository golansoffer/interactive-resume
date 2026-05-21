export type DeviceSupport = { readonly kind: 'desktop' } | { readonly kind: 'unsupported' };

const DESKTOP: DeviceSupport = { kind: 'desktop' };
const UNSUPPORTED: DeviceSupport = { kind: 'unsupported' };

export const deviceSupportFromMatches = (matches: boolean): DeviceSupport =>
  matches ? DESKTOP : UNSUPPORTED;

const DESKTOP_QUERY = '(min-width: 1024px) and (any-pointer: fine)';

const getMediaQueryList = (): MediaQueryList | undefined => {
  const win: Window | undefined = globalThis.window;
  if (win === undefined || typeof win.matchMedia !== 'function') return undefined;
  return win.matchMedia(DESKTOP_QUERY);
};

export const readDeviceSupport = (): DeviceSupport => {
  const mql = getMediaQueryList();
  if (mql === undefined) return DESKTOP;
  return deviceSupportFromMatches(mql.matches);
};

export const subscribeDeviceSupport = (onChange: () => void): (() => void) => {
  const mql = getMediaQueryList();
  if (mql === undefined) return (): void => {};
  const handler = (): void => onChange();
  mql.addEventListener('change', handler);
  return (): void => mql.removeEventListener('change', handler);
};
