import type { CSSProperties, JSX } from 'react';
import { cn } from '@/lib/utils';
import type { VelocityReadout as VelocityReadoutValue } from '../../types/velocity-readout';
import type { MotionPreference } from '../../types/motion-preference';

type VelocityReadoutProps = {
  readonly readout: VelocityReadoutValue;
  readonly motion: MotionPreference;
};

const padded3 = (n: number): string => {
  const i = Math.round(n);
  if (i >= 100) return String(i);
  if (i >= 10) return `0${i}`;
  if (i >= 0) return `00${i}`;
  return String(i);
};

// Hardcoded bright cyan (not the theme accent). The dark-mode `--accent`
// token resolves to a near-black gray and renders the bar invisible at
// 1.5px tall against the dim track; this color is chosen for visibility
// at that thin scale.
const BAR_FILL_CLASSNAME = cn(
  'absolute inset-y-0 left-0 w-full origin-left rounded-full',
  'bg-cyan-300',
  'transition-transform duration-150 ease-out',
  'group-data-[motion=reduced]:transition-none',
);

export const VelocityReadout = (props: VelocityReadoutProps): JSX.Element => {
  const fillStyle: CSSProperties = { transform: `scaleX(${props.readout.ratio})` };
  return (
    <div
      data-zone="telemetry"
      data-motion={props.motion.kind}
      className="group flex shrink-0 select-none flex-col gap-1.5"
    >
      <div className="flex items-baseline gap-2">
        <span
          data-label
          className="font-mono text-[10px] font-medium uppercase tracking-[0.32em] text-(--color-accent)/75"
        >
          VEL
        </span>
        <span
          data-value
          className="font-mono text-base font-semibold leading-none tabular-nums text-foreground"
        >
          {padded3(Math.round(props.readout.ratio * 100))}
        </span>
        <span
          data-unit
          className="font-mono text-[9px] font-medium uppercase tracking-[0.28em] text-muted-foreground"
        >
          %
        </span>
      </div>
      <div
        data-bar
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={props.readout.ratio}
        aria-label="Ship velocity"
        className="relative h-1.5 w-32 overflow-hidden rounded-full bg-foreground/10"
      >
        <span data-bar-fill aria-hidden="true" className={BAR_FILL_CLASSNAME} style={fillStyle} />
      </div>
    </div>
  );
};
