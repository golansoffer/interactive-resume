import type { JSX } from 'react';
import { RichText } from './RichText';

type WorkListProps = {
  readonly work: ReadonlyArray<string>;
};

export const WorkList = ({ work }: WorkListProps): JSX.Element => (
  <section data-section="work" className="px-5 pt-4">
    <h3 className="sr-only">What I did</h3>
    <ul className="flex flex-col gap-3">
      {work.map((bullet, index) => (
        <li
          key={index}
          className="text-pretty text-sm leading-[1.55] text-card-foreground/85"
        >
          <RichText text={bullet} />
        </li>
      ))}
    </ul>
  </section>
);
