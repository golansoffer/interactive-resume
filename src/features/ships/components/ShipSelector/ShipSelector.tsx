import type { JSX } from 'react';
import { cn } from '@/lib/utils';
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

const gridClassName = cn(
  'grid w-full max-w-6xl gap-4',
  'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
);

export const ShipSelector = (props: ShipSelectorProps): JSX.Element => (
  <div className={gridClassName}>
    {props.ships.map((ship) => (
      <ShipCard
        key={ship.id}
        ship={ship}
        isHovered={isHoveredId(props.hover, ship.id)}
        onHoverEnter={props.onHoverEnter}
        onHoverLeave={props.onHoverLeave}
        onPick={props.onPick}
      />
    ))}
  </div>
);
