import type { JSX } from 'react';
import { View } from '@react-three/drei';
import { cn } from '@/lib/utils';
import type { ShipEntry, ShipId } from '../../types/ship';
import { shipCode } from '../../types/ship';
import { ShipViewport } from './ShipViewport';

type ShipCardProps = {
  readonly ship: ShipEntry;
  readonly index: number;
  readonly isHovered: boolean;
  readonly isFeatured: boolean;
  readonly onHoverEnter: (id: ShipId) => void;
  readonly onHoverLeave: () => void;
  readonly onPick: (id: ShipId) => void;
};

// Two-digit padded index for the rail ("01" .. "05"). Domain-local
// formatting; no external dependency.
const formatIndex = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

// On mobile (horizontal strip) cards size to content and don't shrink;
// on desktop (vertical strip) they fill the column width and pick up a
// left accent border. The border-l-2 + transparent default is correct
// for desktop; on mobile it's visually neutral.
const cardClassName = cn(
  'group relative flex shrink-0 items-center gap-3 cursor-pointer',
  'md:w-full',
  'border-l-2 border-transparent bg-transparent',
  'px-3 py-2 text-left text-[--color-fg]',
  'transition-[background-color,border-color,transform] duration-200',
  'hover:bg-[--color-fg]/5 hover:border-[--color-fg]/25',
  'data-[hovered=true]:bg-[--color-fg]/8 data-[hovered=true]:border-[--color-fg]/35',
  'data-[featured=true]:bg-[--color-fg]/12 data-[featured=true]:border-[--color-fg]/50',
  'data-[featured=true]:scale-[1.01]',
  'focus-visible:outline-none focus-visible:bg-[--color-fg]/12',
  'focus-visible:border-[--color-fg]/50',
);

const indexClassName = cn(
  'shrink-0 font-mono text-xs tracking-widest text-[--color-fg]/40',
  'group-hover:text-[--color-fg]/70',
  'group-data-[featured=true]:text-[--color-fg]',
);

const dividerClassName = 'h-10 w-px shrink-0 bg-[--color-fg]/10';

const thumbClassName = cn(
  'relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-black/40',
  'ring-1 ring-white/5',
  'group-data-[featured=true]:ring-[--color-fg]/25',
);

const textColClassName = 'flex min-w-0 flex-col leading-tight';

const codeClassName = cn(
  'font-mono text-[10px] tracking-[0.2em] uppercase text-[--color-fg]/50',
  'group-data-[featured=true]:text-[--color-accent]',
);

const nameClassName = 'truncate text-sm font-medium tracking-wide text-[--color-fg]';

export const ShipCard = (props: ShipCardProps): JSX.Element => (
  <button
    type="button"
    data-hovered={props.isHovered ? 'true' : 'false'}
    data-featured={props.isFeatured ? 'true' : 'false'}
    onMouseEnter={() => props.onHoverEnter(props.ship.id)}
    onMouseLeave={() => props.onHoverLeave()}
    onClick={() => props.onPick(props.ship.id)}
    className={cardClassName}
  >
    <span className={indexClassName}>{formatIndex(props.index)}</span>
    <span className={dividerClassName} aria-hidden="true" />
    <span className={thumbClassName}>
      <View className="absolute inset-0">
        <ShipViewport kind="thumbnail" ship={props.ship} isHovered={props.isHovered} />
      </View>
    </span>
    <span className={textColClassName}>
      <span className={codeClassName}>{shipCode(props.ship.id)}</span>
      <span className={nameClassName}>{props.ship.displayName}</span>
    </span>
  </button>
);
