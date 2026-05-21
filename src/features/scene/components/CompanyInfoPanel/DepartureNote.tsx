import type { JSX } from 'react';
import type { CompanyDeparture } from '../../types/company-info';
import { RichText } from './RichText';

type DepartureNoteProps = {
  readonly departure: Extract<CompanyDeparture, { kind: 'moved_on' }>;
};

export const DepartureNote = ({ departure }: DepartureNoteProps): JSX.Element => (
  <section data-section="departure" className="px-5 pt-4">
    <dl className="flex flex-col gap-1.5">
      <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
        Why I left
      </dt>
      <dd className="ml-0 text-pretty text-[0.8125rem] leading-[1.55] text-muted-foreground italic">
        <RichText text={departure.text} />
      </dd>
    </dl>
  </section>
);
