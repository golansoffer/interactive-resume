import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { Counter } from '../../types/counter';

type ProgressCounterProps = {
  readonly value: Counter;
  // Increments every time the counter ticks. When this prop changes, the
  // visited number plays a brief glow via a CSS keyframe keyed off the
  // attribute. Same value across renders = no animation.
  readonly flipKey: number;
};

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

const visitedNumber = (value: Counter): number => {
  switch (value.kind) {
    case 'idle':
      return value.visited;
    case 'complete':
      return value.total;
  }
};

const isComplete = (value: Counter): boolean => value.kind === 'complete';

const ROOT_CLASSNAME = cn(
  'flex items-baseline justify-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.14em]',
  'text-foreground/55',
);

const NUM_CLASSNAME = cn(
  'font-mono text-[10px] font-semibold tabular-nums',
  'transition-colors duration-300',
);

export const ProgressCounter = (props: ProgressCounterProps): JSX.Element => {
  const complete = isComplete(props.value);
  return (
    <div data-state={props.value.kind} className={ROOT_CLASSNAME}>
      <span
        data-count="visited"
        data-flipping={String(props.flipKey)}
        className={cn(
          NUM_CLASSNAME,
          complete ? 'text-[#7be0a2]' : 'text-(--color-accent)',
        )}
      >
        {pad2(visitedNumber(props.value))}
      </span>
      <span data-divider>/</span>
      <span
        data-count="total"
        className={cn(
          NUM_CLASSNAME,
          complete ? 'text-[#7be0a2]' : 'text-foreground/55',
        )}
      >
        {pad2(props.value.total)}
      </span>
    </div>
  );
};
