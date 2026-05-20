import { motionPreferenceFromMatches, type MotionPreference } from '../types/motion-preference';

const MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

export const subscribePrefersReducedMotion = (
  onChange: (preference: MotionPreference) => void,
): (() => void) => {
  const win: Window | undefined = globalThis.window;
  if (win === undefined || typeof win.matchMedia !== 'function') {
    onChange({ kind: 'normal' });
    return (): void => {};
  }
  const mediaQuery = win.matchMedia(MEDIA_QUERY);
  onChange(motionPreferenceFromMatches(mediaQuery.matches));
  const handleChange = (event: { readonly matches: boolean }): void => {
    onChange(motionPreferenceFromMatches(event.matches));
  };
  mediaQuery.addEventListener('change', handleChange);
  return (): void => {
    mediaQuery.removeEventListener('change', handleChange);
  };
};
