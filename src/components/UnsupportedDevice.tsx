import type { CSSProperties, JSX } from 'react';
import { cn } from '@/lib/utils';

const BACKDROP_STYLE: CSSProperties = {
  background:
    'radial-gradient(80% 60% at 30% 20%, #161616 0%, transparent 60%), ' +
    'radial-gradient(60% 50% at 80% 80%, #1c1c1c 0%, transparent 70%), ' +
    'linear-gradient(180deg, #080808 0%, #0e0e0e 100%)',
};

// min-h-screen is the vh fallback; min-h-dvh (dynamic viewport height) takes over in
// modern browsers so the splash never hides behind a mobile URL bar / safari chrome.
const containerClassName = cn(
  'relative flex min-h-screen min-h-dvh w-screen items-center justify-center',
  'text-(--color-fg) overflow-hidden',
);

// Corner brackets keep their absolute position relative to the viewport edges. They
// scale down on the smallest screens so they don't dominate the layout on a 320px
// phone while still reading as HUD chrome on tablet/desktop.
const cornerBaseClassName = cn(
  'pointer-events-none absolute h-6 w-6 sm:h-8 sm:w-8 border-(--color-fg)/15',
);
const cornerTopLeft = cn(cornerBaseClassName, 'top-3 left-3 sm:top-4 sm:left-4 border-l border-t');
const cornerTopRight = cn(cornerBaseClassName, 'top-3 right-3 sm:top-4 sm:right-4 border-r border-t');
const cornerBottomLeft = cn(cornerBaseClassName, 'bottom-3 left-3 sm:bottom-4 sm:left-4 border-b border-l');
const cornerBottomRight = cn(cornerBaseClassName, 'bottom-3 right-3 sm:bottom-4 sm:right-4 border-b border-r');

// Padding lives on the centred content (NOT the container) so the HUD corners stay
// pinned to the viewport edges while the text breathes inside.
const contentClassName = cn('flex flex-col items-center text-center px-6 sm:px-8 max-w-xl');

// Tracking eases on the smallest screens so the eyebrow doesn't overflow a 320 px viewport.
const eyebrowClassName = cn(
  'font-mono text-[10px] tracking-[0.28em] sm:tracking-[0.4em] uppercase text-(--color-fg)/55',
);

const titleClassName = cn(
  'mt-3 text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-(--color-fg)',
);

// Subtitle ramps from text-sm on phones to text-base on tablet+ for readability.
const subtitleClassName = cn(
  'mt-4 max-w-md text-sm md:text-base leading-relaxed tracking-wide text-(--color-fg)/60',
);

export const UnsupportedDevice = (): JSX.Element => {
  return (
    <main className={containerClassName} style={BACKDROP_STYLE}>
      <span data-hud-corner className={cornerTopLeft} aria-hidden="true" />
      <span data-hud-corner className={cornerTopRight} aria-hidden="true" />
      <span data-hud-corner className={cornerBottomLeft} aria-hidden="true" />
      <span data-hud-corner className={cornerBottomRight} aria-hidden="true" />
      <div className={contentClassName}>
        <span className={eyebrowClassName}>{'// SIGNAL · DESKTOP REQUIRED'}</span>
        <h1 className={titleClassName}>Open this on desktop.</h1>
        <p className={subtitleClassName}>
          This interactive resume runs as a real-time 3D tour built for mouse, keyboard, and a wider screen. Visit again from a desktop browser to launch.
        </p>
      </div>
    </main>
  );
};
