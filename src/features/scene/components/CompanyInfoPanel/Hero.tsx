import type { JSX } from 'react';
import type { Month, Period, YearMonth } from '../../types/period';
import { type PlanetAssetId, planetDisplayName } from '../../types/planet';
import { PlanetPreview } from './PlanetPreview';

type HeroProps = {
  readonly companyName: string;
  readonly role: string;
  readonly period: Period;
  readonly oneLiner: string;
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

const padMonth = (month: Month): string => (month < 10 ? `0${month}` : `${month}`);
const machineYearMonth = (ym: YearMonth): string => `${ym.year}-${padMonth(ym.month)}`;
const displayYearMonth = (ym: YearMonth): string => `${monthName(ym.month)} ${ym.year}`;

const PeriodLine = ({ period }: { readonly period: Period }): JSX.Element => {
  switch (period.kind) {
    case 'ongoing':
      return (
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
          <time dateTime={machineYearMonth(period.start)}>{displayYearMonth(period.start)}</time>
          {' · '}
          <span>Present</span>
        </p>
      );
    case 'closed':
      return (
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
          <time dateTime={machineYearMonth(period.start)}>{displayYearMonth(period.start)}</time>
          {' · '}
          <time dateTime={machineYearMonth(period.end)}>{displayYearMonth(period.end)}</time>
        </p>
      );
  }
};

export const Hero = (props: HeroProps): JSX.Element => (
  <header
    data-section="hero"
    className="grid grid-cols-[5.5rem_1fr] items-start gap-4 px-5 pt-5"
  >
    <div className="flex flex-col items-stretch gap-2">
      <PlanetPreview assetId={props.assetId} />
      <span className="text-center font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70">
        {planetDisplayName(props.assetId)}
      </span>
    </div>

    <div className="flex min-w-0 flex-col items-start gap-1">
      <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {props.companyName}
      </p>
      <h2 className="font-heading text-lg font-semibold leading-[1.15] tracking-[-0.005em] text-foreground">
        {props.role}
      </h2>
      <PeriodLine period={props.period} />
      <p className="mt-2.5 text-pretty text-sm leading-[1.55] text-card-foreground/85">
        {props.oneLiner}
      </p>
    </div>
  </header>
);
