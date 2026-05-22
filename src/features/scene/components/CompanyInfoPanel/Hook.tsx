import type { JSX } from 'react';
import { RichText } from './RichText';

type HookProps = {
  readonly text: string;
};

export const Hook = ({ text }: HookProps): JSX.Element => (
  <section
    data-section="hook"
    aria-label="Position"
    className="px-5 pt-4"
  >
    <p className="font-heading text-pretty whitespace-pre-line text-xl font-semibold leading-[1.2] tracking-[-0.01em] text-foreground">
      <RichText text={text} />
    </p>
  </section>
);
