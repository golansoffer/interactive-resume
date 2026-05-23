import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_SHIP_ID } from '../../types/ship';
import type { ShipEntry, ShipHover, ShipId } from '../../types/ship';
import { lookupShip } from '../../types/shipRegistry';
import { HeroShip } from './HeroShip';
import { ShipCard } from './ShipCard';

type ShipSelectorProps = {
  readonly ships: ReadonlyArray<ShipEntry>;
  readonly hover: ShipHover;
  readonly onHoverEnter: (id: ShipId) => void;
  readonly onHoverLeave: () => void;
  readonly onPick: (id: ShipId) => void;
};

const isHoveredId = (hover: ShipHover, id: ShipId): boolean =>
  hover.kind === 'hovering' && hover.id === id;

// "Featured" = the ship occupying the hero stage. With a hover, that's
// the hovered id; without, the typed default. No nullable lookup —
// DEFAULT_SHIP_ID is a known ShipId at type time.
const isFeaturedId = (hover: ShipHover, id: ShipId): boolean =>
  hover.kind === 'hovering' ? hover.id === id : id === DEFAULT_SHIP_ID;

const featuredShip = (hover: ShipHover): ShipEntry =>
  hover.kind === 'hovering' ? lookupShip(hover.id) : lookupShip(DEFAULT_SHIP_ID);

// Mobile (<md): flex-col-reverse — markup order is strip→hero, but on a
// narrow viewport the hero stage should sit above the strip. The reverse
// flip keeps markup order stable for desktop (strip-left, hero-right)
// while putting the strip at the bottom on mobile.
const rootClassName = cn(
  'flex h-full min-h-0 w-full max-w-6xl mx-auto gap-4 md:gap-8',
  'flex-col-reverse md:flex-row',
);

// Desktop uses overflow-x-hidden (not -visible) alongside overflow-y-auto.
// Per the CSS overflow spec, when one axis is `visible` and the other is
// not, `visible` is coerced to `auto` — which would let a stray sub-pixel
// overflow surface a horizontal scrollbar whenever the y-scrollbar appears
// on shorter viewports. Hiding the x-axis pins the strip to a single
// vertical scroll dimension.
const stripClassName = cn(
  'flex shrink-0 min-h-0 min-w-0',
  'w-full flex-row gap-1 overflow-x-auto',
  'md:w-auto md:basis-[26%] md:flex-col',
  'md:overflow-x-hidden md:overflow-y-auto',
);

const heroSlotClassName = cn('flex min-h-0 min-w-0 flex-1 flex-col');

export const ShipSelector = (props: ShipSelectorProps): JSX.Element => (
  <div className={rootClassName}>
    <div className={stripClassName} onMouseLeave={props.onHoverLeave}>
      {props.ships.map((ship, i) => (
        <ShipCard
          key={ship.id}
          ship={ship}
          index={i + 1}
          isHovered={isHoveredId(props.hover, ship.id)}
          isFeatured={isFeaturedId(props.hover, ship.id)}
          onHoverEnter={props.onHoverEnter}
          onPick={props.onPick}
        />
      ))}
    </div>
    <div className={heroSlotClassName}>
      <HeroShip ship={featuredShip(props.hover)} onPick={props.onPick} />
    </div>
  </div>
);
