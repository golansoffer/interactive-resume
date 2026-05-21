import { useRef, type JSX } from 'react';
import { Card } from '@/components/ui/card';
import type { RevealProjection } from '../../types/reveal-projection';
import type { CompanyInfo } from '../../types/company-info';
import type { PlanetAssetId } from '../../types/planet';
import { Hero } from './Hero';
import { Hook } from './Hook';
import { DecisionSection } from './DecisionSection';
import { WorkList } from './WorkList';
import { DepartureNote } from './DepartureNote';
import { WebsiteFooter } from './WebsiteFooter';

type CompanyInfoPanelProps = {
  readonly projection: RevealProjection;
};

type LastPayload = {
  readonly info: CompanyInfo;
  readonly assetId: PlanetAssetId;
};

const CARD_CLASSNAME =
  'pointer-events-none fixed right-6 top-6 z-50 w-[26rem] max-w-[28rem] bg-card/85 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md transition-[opacity,translate,filter] ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)] data-[state=open]:duration-700 data-[state=closed]:duration-500 data-[state=closed]:translate-x-6 data-[state=closed]:opacity-0 data-[state=closed]:blur-sm data-[state=open]:translate-x-0 data-[state=open]:opacity-100 data-[state=open]:blur-0 motion-reduce:transition-none motion-reduce:translate-none';

export const CompanyInfoPanel = (props: CompanyInfoPanelProps): JSX.Element | null => {
  const lastPayloadRef = useRef<LastPayload | null>(null);
  if (props.projection.kind === 'visible') {
    lastPayloadRef.current = {
      info: props.projection.info,
      assetId: props.projection.assetId,
    };
  }
  const payload = lastPayloadRef.current;

  if (payload === null) return null;

  const state = props.projection.kind === 'visible' ? 'open' : 'closed';
  const info = payload.info;

  return (
    <Card data-state={state} className={CARD_CLASSNAME}>
      <article aria-label={`${info.companyName} · ${info.role}`} className="flex flex-col">
        <Hero
          companyName={info.companyName}
          role={info.role}
          period={info.period}
          oneLiner={info.oneLiner}
          assetId={payload.assetId}
        />

        <Hook text={info.hook} />

        {info.decision.kind === 'recorded' ? (
          <DecisionSection decision={info.decision} />
        ) : null}

        <WorkList work={info.work} />

        {info.departure.kind === 'moved_on' ? (
          <DepartureNote departure={info.departure} />
        ) : null}

        {info.website.kind === 'has_website' ? (
          <WebsiteFooter url={info.website.url} />
        ) : null}
      </article>
    </Card>
  );
};
