import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import type { Counter } from '../../types/counter';
import type { Headline } from '../../types/headline';
import type { Pip } from '../../types/pip';
import type { ProgressProjection } from '../../types/progress-projection';
import type { ProgressVisibility } from '../../types/progress-visibility';
import type { VisitEvent } from '../../types/visit-event';
import { HeadlinePlanet } from './HeadlinePlanet';
import { ProgressCounter } from './ProgressCounter';
import { ProgressPip } from './ProgressPip';
import { StatusLabel } from './StatusLabel';

type ProgressCardProps = {
  readonly projection: ProgressProjection;
  readonly visitEvent: VisitEvent | null;
  readonly motion: MotionPreference;
  readonly visibility: ProgressVisibility;
};

const cardModeFor = (counter: Counter): 'pre_route' | 'mid_route' | 'complete' => {
  if (counter.kind === 'complete') return 'complete';
  return counter.visited === 0 ? 'pre_route' : 'mid_route';
};

const isVisitBurst = (event: VisitEvent): boolean =>
  event.kind === 'first_visit' || event.kind === 'route_complete';

const isCardBursting = (event: VisitEvent | null): boolean =>
  event !== null && isVisitBurst(event);

const pipBursting = (pip: Pip, event: VisitEvent | null): boolean => {
  if (event === null) return false;
  if (!isVisitBurst(event)) return false;
  return pip.companyId === event.companyId;
};

const headlineShortCodeText = (headline: Headline): string =>
  headline.kind === 'empty' ? '—' : headline.company.shortCode;

const CARD_CLASSNAME = cn(
  'pointer-events-none fixed left-6 top-1/2 z-40 -translate-y-1/2',
  'flex w-[84px] flex-col items-stretch gap-2',
  'rounded-xl bg-card/85 px-[0.6rem] py-[0.85rem] pb-[0.7rem]',
  'ring-1 ring-foreground/10 shadow-2xl backdrop-blur-md',
  'border border-foreground/10',
  'transition-[border-color,box-shadow,background-color] duration-[800ms] ease-out',
  'data-[burst=active]:border-(--color-accent)',
  'data-[burst=active]:shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_0_1.5px_rgba(95,214,255,0.18),0_0_22px_rgba(95,214,255,0.24),0_0_60px_rgba(95,214,255,0.10)]',
  // Complete state — subtle green wash: faint bg tint, soft ring, breathing
  // border (keyframe in globals.css). Kept calm so it reads as ambient
  // confirmation, not an alarm.
  'data-[state=complete]:animate-[progress-card-breathe_6s_ease-in-out_infinite]',
  'data-[state=complete]:border-[rgba(123,224,162,0.18)]',
  'data-[state=complete]:bg-[rgba(12,20,16,0.85)]',
  'data-[state=complete]:ring-[rgba(123,224,162,0.14)]',
  'motion-reduce:transition-none',
  'data-[motion=reduced]:transition-none',
  'data-[motion=reduced]:animate-none',
);

const SHORT_CODE_CLASSNAME = cn(
  'font-mono text-[13px] font-semibold leading-tight tracking-[0.14em]',
  'text-center text-foreground',
);

const SHORT_CODE_EMPTY_CLASSNAME = cn(SHORT_CODE_CLASSNAME, 'text-foreground/22 font-medium');

const RULE_CLASSNAME = cn(
  'h-px w-full',
  'bg-[linear-gradient(90deg,transparent_0%,rgba(230,234,242,0.10)_25%,rgba(230,234,242,0.10)_75%,transparent_100%)]',
);

const HeadlineMeta = (props: { readonly headline: Headline }): JSX.Element => (
  <div className="flex flex-col items-center gap-[2px] text-center">
    <span
      data-headline-code
      className={
        props.headline.kind === 'empty'
          ? SHORT_CODE_EMPTY_CLASSNAME
          : SHORT_CODE_CLASSNAME
      }
    >
      {headlineShortCodeText(props.headline)}
    </span>
  </div>
);

const PipColumn = (props: {
  readonly projection: ProgressProjection;
  readonly visitEvent: VisitEvent | null;
  readonly motion: MotionPreference;
}): JSX.Element => (
  <div className="flex flex-col items-center gap-2 pt-[2px]">
    {props.projection.pips.map((pip) => (
      <ProgressPip
        key={pip.companyId}
        pip={pip}
        isBursting={pipBursting(pip, props.visitEvent)}
        motion={props.motion}
      />
    ))}
  </div>
);

export const ProgressCard = (props: ProgressCardProps): JSX.Element | null => {
  if (props.visibility.kind === 'hidden') return null;

  const cardMode = cardModeFor(props.projection.counter);
  const bursting = isCardBursting(props.visitEvent);
  const visitedCount =
    props.projection.counter.kind === 'idle'
      ? props.projection.counter.visited
      : props.projection.counter.total;

  return (
    <section
      data-progress-card
      data-state={cardMode}
      data-burst={bursting ? 'active' : 'idle'}
      data-motion={props.motion.kind}
      aria-label="Exploration progress"
      className={CARD_CLASSNAME}
    >
      <div className="flex items-center justify-center pt-[2px]">
        <HeadlinePlanet headline={props.projection.headline} />
      </div>
      <HeadlineMeta headline={props.projection.headline} />
      <StatusLabel value={props.projection.status} />
      <span aria-hidden="true" className={RULE_CLASSNAME} />
      <ProgressCounter value={props.projection.counter} flipKey={visitedCount} />
      <span aria-hidden="true" className={RULE_CLASSNAME} />
      <PipColumn
        projection={props.projection}
        visitEvent={props.visitEvent}
        motion={props.motion}
      />
    </section>
  );
};
