import type { JSX } from 'react';
import { View } from '@react-three/drei';
import { cn } from '@/lib/utils';
import type { HeroPhase, ShipEntry, ShipId } from '../../types/ship';
import { shipCode } from '../../types/ship';
import {
  HeroSceneSetup,
  HeroShipMesh,
  type HeroOpacityPolicy,
} from './HeroScene';

type HeroShipProps = {
  readonly phase: HeroPhase;
  readonly onPick: (id: ShipId) => void;
};

const containerClassName = cn(
  'flex h-full min-h-0 w-full flex-col items-stretch gap-3 md:gap-4',
);

// Viewport fills all remaining vertical space in the hero column. min-h-0
// defeats the intrinsic-size floor that would otherwise prevent the flex
// item from shrinking below its content.
const viewportClassName = cn(
  'relative flex-1 min-h-0 w-full overflow-hidden rounded-lg',
  'bg-[radial-gradient(120%_80%_at_50%_40%,#0a1730_0%,#04070f_70%)]',
  'ring-1 ring-white/5',
);

// The info-block shell reserves layout space for one block; the outgoing
// block is absolute-pinned over the incoming so both occupy the same
// coordinates during a swap.
const infoBlockShellClassName = cn('relative shrink-0');

const infoBlockClassName = cn(
  'flex flex-col items-start gap-2 md:gap-3',
);

const infoBlockIncomingClassName = cn(
  'animate-[fadeIn_400ms_cubic-bezier(0.16,1,0.3,1)]',
);

const infoBlockOutgoingClassName = cn(
  'absolute inset-0 pointer-events-none',
  'animate-[fadeOut_400ms_cubic-bezier(0.16,1,0.3,1)_forwards]',
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

type InfoBlockProps = {
  readonly ship: ShipEntry;
  readonly onPick: (id: ShipId) => void;
  readonly className: string;
};

const InfoBlock = (props: InfoBlockProps): JSX.Element => (
  <div className={props.className}>
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
);

// Decoded view of the phase — what to mount in the View and what to
// render in the text shell. Two flat variants; no optional fields.
type HeroRender =
  | {
      readonly kind: 'stable';
      readonly ship: ShipEntry;
    }
  | {
      readonly kind: 'transitioning';
      readonly outgoing: ShipEntry;
      readonly incoming: ShipEntry;
      readonly startedAt: number;
    };

const decodePhase = (phase: HeroPhase): HeroRender => {
  switch (phase.kind) {
    case 'stable':
      return { kind: 'stable', ship: phase.current };
    case 'transitioning':
      return {
        kind: 'transitioning',
        outgoing: phase.outgoing,
        incoming: phase.incoming,
        startedAt: phase.startedAt,
      };
  }
};

const OPAQUE_POLICY: HeroOpacityPolicy = { kind: 'opaque' };

const meshesFor = (render: HeroRender): JSX.Element => {
  switch (render.kind) {
    case 'stable':
      return <HeroShipMesh ship={render.ship} opacityPolicy={OPAQUE_POLICY} />;
    case 'transitioning':
      return (
        <>
          <HeroShipMesh
            key={`out-${render.outgoing.id}-${render.startedAt}`}
            ship={render.outgoing}
            opacityPolicy={{ kind: 'fading_out', startedAt: render.startedAt }}
          />
          <HeroShipMesh
            key={`in-${render.incoming.id}-${render.startedAt}`}
            ship={render.incoming}
            opacityPolicy={{ kind: 'fading_in', startedAt: render.startedAt }}
          />
        </>
      );
  }
};

const textFor = (render: HeroRender, onPick: (id: ShipId) => void): JSX.Element => {
  switch (render.kind) {
    case 'stable':
      return (
        <InfoBlock
          key={`stable-${render.ship.id}`}
          ship={render.ship}
          onPick={onPick}
          className={cn(infoBlockClassName, infoBlockIncomingClassName)}
        />
      );
    case 'transitioning':
      return (
        <>
          <InfoBlock
            key={`in-${render.incoming.id}-${render.startedAt}`}
            ship={render.incoming}
            onPick={onPick}
            className={cn(infoBlockClassName, infoBlockIncomingClassName)}
          />
          <InfoBlock
            key={`out-${render.outgoing.id}-${render.startedAt}`}
            ship={render.outgoing}
            onPick={onPick}
            className={cn(infoBlockClassName, infoBlockOutgoingClassName)}
          />
        </>
      );
  }
};

export const HeroShip = (props: HeroShipProps): JSX.Element => {
  const render = decodePhase(props.phase);
  return (
    <div className={containerClassName}>
      <div className={viewportClassName}>
        <View className="absolute inset-0">
          <HeroSceneSetup />
          {meshesFor(render)}
        </View>
      </div>
      <div className={infoBlockShellClassName}>
        {textFor(render, props.onPick)}
      </div>
    </div>
  );
};
