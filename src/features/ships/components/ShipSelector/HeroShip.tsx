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
  'flex h-full min-h-0 w-full flex-col items-stretch gap-3 md:gap-4',
);

// Viewport — fills all remaining vertical space in the hero column. No
// aspect-ratio: the height is the parent's flex height (flex-1 min-h-0
// chain). min-h-0 defeats the intrinsic-size floor that would otherwise
// prevent the flex item from shrinking below its content.
const viewportClassName = cn(
  'relative flex-1 min-h-0 w-full overflow-hidden rounded-lg',
  'bg-[radial-gradient(120%_80%_at_50%_40%,#0a1730_0%,#04070f_70%)]',
  'ring-1 ring-white/5',
);

const infoBlockClassName = cn(
  'shrink-0 flex flex-col items-start gap-2 md:gap-3',
  'animate-[fadeIn_240ms_ease-out]',
);

const codeClassName = cn(
  'font-mono text-xs tracking-[0.4em] uppercase text-[--color-accent]/80',
);

const nameClassName = cn(
  'text-3xl sm:text-4xl md:text-5xl xl:text-6xl',
  'font-semibold tracking-tight text-[--color-fg] leading-none',
);

const separatorClassName = cn('h-px w-24 bg-[--color-accent]/40');

const launchButtonClassName = cn(
  'inline-flex items-center gap-2 rounded-md',
  'border border-[--color-accent]/60 bg-[--color-accent]/10',
  'px-5 py-2 md:px-6 md:py-3 text-sm font-medium tracking-wider uppercase',
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
