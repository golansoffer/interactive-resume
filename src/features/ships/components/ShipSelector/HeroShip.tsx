import type { JSX } from 'react';
import { View } from '@react-three/drei';
import { cn } from '@/lib/utils';
import type { ShipEntry, ShipId } from '../../types/ship';
import { shipCode } from '../../types/ship';
import { ShipViewport } from './ShipViewport';

type HeroShipProps = {
  readonly ship: ShipEntry;
  readonly onPick: (id: ShipId) => void;
};

const containerClassName = cn(
  'flex h-full w-full flex-col items-stretch justify-center gap-6',
);

// Viewport — full bleed of the hero column; the ship breathes here.
// Aspect set so the canvas reads as a 4:3 stage rather than a square card.
const viewportClassName = cn(
  'relative w-full overflow-hidden rounded-lg',
  'bg-[radial-gradient(120%_80%_at_50%_40%,#0a1730_0%,#04070f_70%)]',
  'ring-1 ring-white/5',
  'aspect-[4/3] max-h-[60vh]',
);

const infoBlockClassName = cn(
  'flex flex-col items-start gap-3',
  'animate-[fadeIn_240ms_ease-out]',
);

const codeClassName = cn(
  'font-mono text-xs tracking-[0.4em] uppercase text-[--color-accent]/80',
);

const nameClassName = cn(
  'text-5xl md:text-6xl font-semibold tracking-tight text-[--color-fg]',
);

const separatorClassName = cn('h-px w-24 bg-[--color-accent]/40');

const launchButtonClassName = cn(
  'inline-flex items-center gap-2 rounded-md',
  'border border-[--color-accent]/60 bg-[--color-accent]/10',
  'px-6 py-3 text-sm font-medium tracking-wider uppercase',
  'text-[--color-accent] transition-all duration-200',
  'hover:bg-[--color-accent]/20 hover:border-[--color-accent]',
  'hover:shadow-[0_0_24px_-4px_var(--color-accent)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]',
);

export const HeroShip = (props: HeroShipProps): JSX.Element => (
  <div className={containerClassName}>
    <div className={viewportClassName}>
      <View className="absolute inset-0">
        <ShipViewport kind="hero" ship={props.ship} />
      </View>
    </div>
    {/* key on id => remount + fade-in keyframe whenever the featured ship changes */}
    <div key={props.ship.id} className={infoBlockClassName}>
      <span className={codeClassName}>{shipCode(props.ship.id)}</span>
      <h2 className={nameClassName}>{props.ship.displayName}</h2>
      <span className={separatorClassName} aria-hidden="true" />
      <button
        type="button"
        onClick={() => props.onPick(props.ship.id)}
        className={launchButtonClassName}
      >
        <span aria-hidden="true">▸</span>
        <span>Launch this craft</span>
      </button>
    </div>
  </div>
);
