import type { JSX } from 'react';
import type { CompanyDecision } from '../../types/company-info';
import { RichText } from './RichText';

type DecisionSectionProps = {
  readonly decision: Extract<CompanyDecision, { kind: 'recorded' }>;
};

export const DecisionSection = ({ decision }: DecisionSectionProps): JSX.Element => (
  <section data-section="decision" className="px-5 pt-4">
    <blockquote className="rounded-md border-l-2 border-foreground/20 bg-foreground/5 py-3 pl-3.5 pr-3">
      <q className="block text-pretty text-[0.9375rem] leading-[1.55] text-card-foreground/95 [quotes:none]">
        <RichText text={decision.text} />
      </q>
    </blockquote>
  </section>
);
