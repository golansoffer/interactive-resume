import type { CSSProperties, JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, View } from '@react-three/drei';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/assetUrl';
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

// Two soft neutral pools (a brighter pool top-left, a deeper pool
// bottom-right) over a near-black neutral base — gives the page depth
// without introducing chroma. All values are pure grayscale (R == G == B)
// to sit in the same neutral register as the CompanyInfoPanel.
const BACKDROP_STYLE: CSSProperties = {
  background:
    'radial-gradient(80% 60% at 30% 20%, #161616 0%, transparent 60%), ' +
    'radial-gradient(60% 50% at 80% 80%, #1c1c1c 0%, transparent 70%), ' +
    'linear-gradient(180deg, #080808 0%, #0e0e0e 100%)',
};

const containerClassName = cn(
  'relative flex h-screen w-screen flex-col items-stretch',
  'text-(--color-fg) overflow-hidden',
);

const headerClassName = cn(
  'shrink-0 flex w-full max-w-6xl flex-col gap-1 self-center',
  'px-8 pt-6 md:pt-8',
);

const eyebrowClassName = cn(
  'font-mono text-[10px] tracking-[0.4em] uppercase text-(--color-fg)/55',
);

const titleClassName = cn(
  'text-2xl md:text-3xl font-semibold tracking-tight text-(--color-fg)',
);

const subtitleClassName = cn(
  'text-xs md:text-sm tracking-wide text-(--color-fg)/60',
);

const bodyClassName = cn(
  'w-full min-h-0 flex-1 self-center',
  'px-8 py-4 md:py-6',
);

// HUD corner brackets — four L-shapes pinned to the edges. Pure
// decoration; neutral foreground hairline matches the panel's
// restrained ring/divider register (cyan is reserved for CTAs and
// visual captions, not chrome).
const cornerClassName = cn('pointer-events-none absolute h-8 w-8 border-(--color-fg)/15');
const cornerBottomLeft = cn(cornerClassName, 'bottom-4 left-4 border-b border-l');
const cornerBottomRight = cn(cornerClassName, 'bottom-4 right-4 border-b border-r');

export const ShipSelectorWidget = (props: ShipSelectorWidgetProps): JSX.Element => {
  const { ships, hover, onHoverEnter, onHoverLeave } = useShipSelector();
  return (
    <div className={containerClassName} style={BACKDROP_STYLE}>
      
      
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

for (const ship of ALL_SHIPS) useGLTF.preload(assetUrl(ship.glbPath));
