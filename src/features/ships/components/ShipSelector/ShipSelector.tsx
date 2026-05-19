import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_SHIP_ID } from '../../types/ship';
import type { ShipEntry, ShipHover, ShipId } from '../../types/ship';
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

const stripClassName = cn('flex w-full max-w-md flex-col gap-1');

export const ShipSelector = (props: ShipSelectorProps): JSX.Element => (
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
);
