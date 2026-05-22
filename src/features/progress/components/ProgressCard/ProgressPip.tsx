import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import type { Pip } from '../../types/pip';
import { PlanetCanvas } from './PlanetCanvas';

type ProgressPipProps = {
  readonly pip: Pip;
  readonly isBursting: boolean;
  readonly motion: MotionPreference;
};

// 16px diameter
const SIZE_CLASSNAME = 'h-4 w-4';

const STATE_CLASSNAME: Readonly<Record<Pip['kind'], string>> = {
  unvisited: 'grayscale brightness-[0.45] contrast-[0.85] opacity-40',
  visited: '',
  here: cn(
    'shadow-[0_0_0_1px_rgba(95,214,255,0.14),0_0_5px_rgba(95,214,255,0.45),0_0_10px_rgba(95,214,255,0.10)]',
  ),
};

const renderRipples = (): JSX.Element => (
  <>
    <span
      data-ripple="small"
      aria-hidden="true"
      className="absolute -inset-[3px] rounded-full border-[1.5px] border-(--color-accent) opacity-60"
    />
    <span
      data-ripple="big"
      aria-hidden="true"
      className="absolute -inset-3 rounded-full border border-(--color-accent) opacity-35"
    />
    <span
      data-ripple="huge"
      aria-hidden="true"
      className="absolute -inset-[22px] rounded-full border border-(--color-accent) opacity-20"
    />
  </>
);

export const ProgressPip = (props: ProgressPipProps): JSX.Element => {
  const showRipples = props.isBursting && props.motion.kind === 'normal';
  return (
    <div
      data-pip
      data-state={props.pip.kind}
      data-burst={props.isBursting ? 'active' : 'idle'}
      data-motion={props.motion.kind}
      data-company={props.pip.companyId}
      className={cn(
        'relative rounded-full',
        SIZE_CLASSNAME,
        STATE_CLASSNAME[props.pip.kind],
        'transition-[filter,opacity,box-shadow,transform] duration-300 ease-out',
        'data-[motion=reduced]:transition-none',
      )}
    >
      <PlanetCanvas assetId={props.pip.assetId} rotates={false} />
      {showRipples ? renderRipples() : null}
    </div>
  );
};
