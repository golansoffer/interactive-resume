import { useRef, type JSX } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { RevealProjection } from '../../types/reveal-projection';
import type { CompanyInfo } from '../../types/company-info';
import type { Month, Period, YearMonth } from '../../types/period';
import { type PlanetAssetId, planetDisplayName } from '../../types/planet';
import { PlanetPreview } from './PlanetPreview';

type CompanyInfoPanelProps = {
  readonly projection: RevealProjection;
};

type LastPayload = {
  readonly info: CompanyInfo;
  readonly assetId: PlanetAssetId;
};

const monthName = (month: Month): string => {
  switch (month) {
    case 1: return 'Jan';
    case 2: return 'Feb';
    case 3: return 'Mar';
    case 4: return 'Apr';
    case 5: return 'May';
    case 6: return 'Jun';
    case 7: return 'Jul';
    case 8: return 'Aug';
    case 9: return 'Sep';
    case 10: return 'Oct';
    case 11: return 'Nov';
    case 12: return 'Dec';
  }
};

const formatYearMonth = (ym: YearMonth): string => `${monthName(ym.month)} ${ym.year}`;

const formatPeriod = (period: Period): string => {
  switch (period.kind) {
    case 'ongoing':
      return `${formatYearMonth(period.start)} — Present`;
    case 'closed':
      return `${formatYearMonth(period.start)} — ${formatYearMonth(period.end)}`;
  }
};

const displayHost = (url: string): string =>
  url.replace(/^https?:\/\//u, '').replace(/^www\./u, '').replace(/\/$/u, '');

const WebsiteLink = ({ url }: { readonly url: string }): JSX.Element => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer noopener"
    className="pointer-events-auto group inline-flex items-center gap-1.5 rounded-sm text-xs font-medium tracking-wide text-[--color-accent] transition-colors hover:text-[--color-accent]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
  >
    <span>{displayHost(url)}</span>
    <ExternalLink
      className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      aria-hidden="true"
    />
  </a>
);

const PanelHeader = (props: LastPayload): JSX.Element => (
  <CardHeader className="grid grid-cols-[5rem_1fr] items-start gap-4">
    <div className="flex flex-col items-stretch gap-2">
      <PlanetPreview assetId={props.assetId} />
      <span className="text-center font-mono text-[10px] uppercase tracking-[0.32em] text-[--color-accent]/80">
        {planetDisplayName(props.assetId)}
      </span>
    </div>

    <div className="flex min-w-0 flex-col items-start gap-1">
      <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {props.info.companyName}
      </CardDescription>
      <CardTitle className="text-lg font-semibold leading-tight tracking-tight text-foreground">
        {props.info.role}
      </CardTitle>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
        {formatPeriod(props.info.period)}
      </p>
    </div>
  </CardHeader>
);

const WebsiteFooter = ({ url }: { readonly url: string }): JSX.Element => (
  <CardFooter className="border-t-0 bg-transparent p-0">
    <div className="flex w-full items-center justify-between px-4 pb-3 pt-1">
      <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Visit
      </span>
      <WebsiteLink url={url} />
    </div>
  </CardFooter>
);

const CARD_CLASSNAME =
  'pointer-events-none fixed right-6 top-6 z-50 w-[23rem] max-w-[24rem] bg-card/85 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md transition-[opacity,transform,filter] ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)] data-[state=open]:duration-700 data-[state=closed]:duration-500 data-[state=closed]:translate-x-6 data-[state=closed]:opacity-0 data-[state=closed]:blur-sm data-[state=open]:translate-x-0 data-[state=open]:opacity-100 data-[state=open]:blur-0 motion-reduce:transition-none motion-reduce:transform-none';

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

  return (
    <Card data-state={state} className={CARD_CLASSNAME}>
      <PanelHeader info={payload.info} assetId={payload.assetId} />
      <div className="mx-4 h-px bg-foreground/10" aria-hidden="true" />
      <CardContent>
        <p className="text-pretty text-sm leading-relaxed text-card-foreground/90">{payload.info.description}</p>
      </CardContent>
      {payload.info.website.kind === 'has_website' ? (
        <WebsiteFooter url={payload.info.website.url} />
      ) : null}
    </Card>
  );
};
