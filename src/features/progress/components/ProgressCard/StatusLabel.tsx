import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { StatusLabel as StatusLabelValue } from '../../types/status-label';

const CheckGlyph = (): JSX.Element => (
  <svg
    width="9"
    height="9"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5L20 7" />
  </svg>
);

type StatusLabelProps = {
  readonly value: StatusLabelValue;
};

// Short forms so the label never wraps inside the 84px-wide card.
const TEXT_FOR: Readonly<Record<StatusLabelValue['kind'], string>> = {
  standby: 'STANDBY',
  active: 'ACTIVE',
  last_explored: 'EXPLORED',
  route_complete: 'COMPLETE',
};

const TYPE_CLASSNAME = cn(
  'font-mono text-[7px] font-medium uppercase tracking-[0.22em]',
  'transition-colors duration-200',
);

// Container holds a fixed line so layout never shifts between states. The
// complete pill is taller than plain text, so we lift the container to its
// height — non-complete states sit inside this height as plain text.
const ROOT_CLASSNAME = 'inline-flex h-[14px] items-center justify-center';

const PLAIN_COLOR: Readonly<Record<'standby' | 'active' | 'last_explored', string>> = {
  standby: 'text-foreground/30',
  active: 'text-(--color-accent)',
  last_explored: 'text-(--color-accent)',
};

const PILL_CLASSNAME = cn(
  ROOT_CLASSNAME,
  TYPE_CLASSNAME,
  'gap-[3px] rounded-full px-[6px]',
  'border border-[#7be0a2]/45 bg-[#7be0a2]/12',
  'text-[#7be0a2]',
  'shadow-[0_0_8px_rgba(123,224,162,0.18)]',
);

export const StatusLabel = (props: StatusLabelProps): JSX.Element => {
  if (props.value.kind === 'route_complete') {
    return (
      <span data-status="route_complete" className={PILL_CLASSNAME}>
        <CheckGlyph />
        <span>{TEXT_FOR['route_complete']}</span>
      </span>
    );
  }
  return (
    <span
      data-status={props.value.kind}
      className={cn(ROOT_CLASSNAME, TYPE_CLASSNAME, PLAIN_COLOR[props.value.kind])}
    >
      {TEXT_FOR[props.value.kind]}
    </span>
  );
};
