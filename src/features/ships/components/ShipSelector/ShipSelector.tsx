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

const rootClassName = cn(
  'grid w-full max-w-6xl gap-8 md:gap-12',
  'grid-cols-1 md:grid-cols-[minmax(20rem,1fr)_2fr]',
  'items-start',
);

const stripClassName = cn('flex w-full flex-col gap-1');

export const ShipSelector = (props: ShipSelectorProps): JSX.Element => (
  <div className={rootClassName}>
    <div className={stripClassName}>
      {props.ships.map((ship, i) => (
        <ShipCard
          key={ship.id}
          ship={ship}
          index={i + 1}
          isHovered={isHoveredId(props.hover, ship.id)}
          isFeatured={isFeaturedId(props.hover, ship.id)}
          onHoverEnter={props.onHoverEnter}
          onHoverLeave={props.onHoverLeave}
          onPick={props.onPick}
        />
      ))}
    </div>
    <HeroShip ship={featuredShip(props.hover)} onPick={props.onPick} />
  </div>
);
