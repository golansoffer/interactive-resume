import type { CSSProperties, JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, View } from '@react-three/drei';
import { cn } from '@/lib/utils';
import { ShipSelector } from '../../components/ShipSelector/ShipSelector';
import { ALL_SHIPS } from '../../types/shipRegistry';
import type { ShipId } from '../../types/ship';
import { useShipSelector } from './useShipSelector';

type ShipSelectorWidgetProps = {
  readonly onPick: (id: ShipId) => void;
};

const CANVAS_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
};

// Two soft radial pools (warm-ish top-left, cool bottom-right) over the
// base bg — gives the page depth without going full starfield.
const BACKDROP_STYLE: CSSProperties = {
  background:
    'radial-gradient(80% 60% at 30% 20%, #0b1422 0%, transparent 60%), ' +
    'radial-gradient(60% 50% at 80% 80%, #0a1830 0%, transparent 70%), ' +
    'linear-gradient(180deg, #04050a 0%, #060912 100%)',
};

const containerClassName = cn(
  'relative flex h-screen w-screen flex-col items-stretch',
  'text-[--color-fg] overflow-hidden',
);

const headerClassName = cn(
  'shrink-0 flex w-full max-w-6xl flex-col gap-1 self-center',
  'px-8 pt-6 md:pt-8',
);

const eyebrowClassName = cn(
  'font-mono text-[10px] tracking-[0.4em] uppercase text-[--color-accent]/70',
);

const titleClassName = cn(
  'text-2xl md:text-3xl font-semibold tracking-tight text-[--color-fg]',
);

const subtitleClassName = cn(
  'text-xs md:text-sm tracking-wide text-[--color-fg]/60',
);

const bodyClassName = cn(
  'w-full min-h-0 flex-1 self-center',
  'px-8 py-4 md:py-6',
);

// HUD corner brackets — four L-shapes pinned to the edges. Pure
// decoration; the accent color picks up the cyan ship-wake.
const cornerClassName = cn('pointer-events-none absolute h-8 w-8 border-[--color-accent]/40');
const cornerTopLeft = cn(cornerClassName, 'left-4 top-4 border-l border-t');
const cornerTopRight = cn(cornerClassName, 'right-4 top-4 border-r border-t');
const cornerBottomLeft = cn(cornerClassName, 'bottom-4 left-4 border-b border-l');
const cornerBottomRight = cn(cornerClassName, 'bottom-4 right-4 border-b border-r');

export const ShipSelectorWidget = (props: ShipSelectorWidgetProps): JSX.Element => {
  const { ships, hover, heroPhase, onHoverEnter, onHoverLeave } = useShipSelector();
  return (
    <div className={containerClassName} style={BACKDROP_STYLE}>
      <span className={cornerTopLeft} aria-hidden="true" />
      <span className={cornerTopRight} aria-hidden="true" />
      <span className={cornerBottomLeft} aria-hidden="true" />
      <span className={cornerBottomRight} aria-hidden="true" />
      <header className={headerClassName}>
        <span className={eyebrowClassName}>{'// FLEET REGISTRY'}</span>
        <h1 className={titleClassName}>Choose your ship</h1>
        <p className={subtitleClassName}>
          Five crafts. Pick one. Your runner for the tour.
        </p>
      </header>
      <main className={bodyClassName}>
        <ShipSelector
          ships={ships}
          hover={hover}
          heroPhase={heroPhase}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
          onPick={props.onPick}
        />
      </main>
      <Canvas style={CANVAS_STYLE} dpr={[1, 2]}>
        <View.Port />
      </Canvas>
    </div>
  );
};

for (const ship of ALL_SHIPS) useGLTF.preload(ship.glbPath);
