import type { CSSProperties, JSX } from 'react';
import { cn } from '@/lib/utils';

const BACKDROP_STYLE: CSSProperties = {
  background:
    'radial-gradient(80% 60% at 30% 20%, #161616 0%, transparent 60%), ' +
    'radial-gradient(60% 50% at 80% 80%, #1c1c1c 0%, transparent 70%), ' +
    'linear-gradient(180deg, #080808 0%, #0e0e0e 100%)',
};

const containerClassName = cn(
  'relative flex h-screen w-screen items-center justify-center',
  'text-(--color-fg) overflow-hidden',
);

const cornerBaseClassName = cn(
  'pointer-events-none absolute h-8 w-8 border-(--color-fg)/15',
);
const cornerTopLeft = cn(cornerBaseClassName, 'top-4 left-4 border-l border-t');
const cornerTopRight = cn(cornerBaseClassName, 'top-4 right-4 border-r border-t');
const cornerBottomLeft = cn(cornerBaseClassName, 'bottom-4 left-4 border-b border-l');
const cornerBottomRight = cn(cornerBaseClassName, 'bottom-4 right-4 border-b border-r');

const contentClassName = cn('flex flex-col items-center text-center');

const eyebrowClassName = cn(
  'font-mono text-[10px] tracking-[0.4em] uppercase text-(--color-fg)/55',
);

const titleClassName = cn(
  'mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-(--color-fg)',
);

const subtitleClassName = cn(
  'mt-4 max-w-md text-xs md:text-sm leading-relaxed tracking-wide text-(--color-fg)/60',
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
