import type { JSX } from 'react';
import { View } from '@react-three/drei';
import { cn } from '@/lib/utils';
import type { ShipEntry, ShipId } from '../../types/ship';
import { ShipViewport } from './ShipViewport';

type ShipCardProps = {
  readonly ship: ShipEntry;
  readonly isHovered: boolean;
  readonly onHoverEnter: (id: ShipId) => void;
  readonly onHoverLeave: () => void;
  readonly onPick: (id: ShipId) => void;
};

const cardClassName = cn(
  'group flex flex-col items-stretch gap-2 rounded-2xl border border-white/10',
  'bg-[--color-card] p-3 text-left text-[--color-fg] cursor-pointer',
  'transition-colors transition-transform duration-200',
  'hover:bg-[--color-card-hover] hover:-translate-y-0.5',
  'data-[hovered=true]:ring-2 data-[hovered=true]:ring-[--color-card-ring]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]',
);

const thumbClassName = 'relative aspect-square w-full rounded-xl overflow-hidden bg-black/30';
const labelClassName = 'text-sm font-medium tracking-wide';

export const ShipCard = (props: ShipCardProps): JSX.Element => (
  <button
    type="button"
    data-hovered={props.isHovered ? 'true' : 'false'}
    onMouseEnter={() => props.onHoverEnter(props.ship.id)}
    onMouseLeave={() => props.onHoverLeave()}
    onClick={() => props.onPick(props.ship.id)}
    className={cardClassName}
  >
    <div className={thumbClassName}>
      <View className="absolute inset-0">
        <ShipViewport kind="thumbnail" ship={props.ship} isHovered={props.isHovered} />
      </View>
    </div>
    <span className={labelClassName}>{props.ship.displayName}</span>
  </button>
);
