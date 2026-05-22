import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { Headline } from '../../types/headline';
import { PlanetCanvas } from './PlanetCanvas';

type HeadlinePlanetProps = {
  readonly headline: Headline;
};

const BASE_CLASSNAME = 'relative flex items-center justify-center';
const SIZE_CLASSNAME = 'h-[52px] w-[52px]';

const EMPTY_CLASSNAME = cn(
  BASE_CLASSNAME,
  SIZE_CLASSNAME,
  'rounded-full border-[1.5px] border-dashed border-foreground/20',
  'bg-[radial-gradient(circle_at_50%_50%,rgba(230,234,242,0.06)_0%,rgba(230,234,242,0.0)_70%)]',
);

const ACTIVE_GLOW_CLASSNAME = cn(
  'shadow-[0_0_0_1.5px_rgba(95,214,255,0.14),0_0_10px_rgba(95,214,255,0.45),0_0_20px_rgba(95,214,255,0.10)]',
);

const COMPLETE_GLOW_CLASSNAME = cn(
  'shadow-[0_0_0_1.5px_rgba(123,224,162,0.14),0_0_10px_rgba(123,224,162,0.45),0_0_20px_rgba(123,224,162,0.10)]',
);

const glowClassFor = (kind: Headline['kind']): string => {
  switch (kind) {
    case 'empty':
    case 'anchor':
      return '';
    case 'active':
      return ACTIVE_GLOW_CLASSNAME;
    case 'complete':
      return COMPLETE_GLOW_CLASSNAME;
  }
};

export const HeadlinePlanet = (props: HeadlinePlanetProps): JSX.Element => {
  if (props.headline.kind === 'empty') {
    return <div data-state="empty" data-headline className={EMPTY_CLASSNAME} aria-hidden="true" />;
  }
  const { company } = props.headline;
  return (
    <div
      data-state={props.headline.kind}
      data-headline
      className={cn(BASE_CLASSNAME, SIZE_CLASSNAME, 'rounded-full', glowClassFor(props.headline.kind))}
      aria-label={`Planet for ${company.id}`}
    >
      <PlanetCanvas assetId={company.assetId} />
    </div>
  );
};
