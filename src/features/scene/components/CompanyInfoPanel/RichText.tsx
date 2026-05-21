import type { JSX } from 'react';

type RichTextProps = {
  readonly text: string;
};

const BOLD_PATTERN = /(\*\*[^*]+\*\*)/u;

export const RichText = ({ text }: RichTextProps): JSX.Element => {
  const parts = text.split(BOLD_PATTERN);
  return (
    <>
      {parts.map((part, index) => {
        const isBold = index % 2 === 1;
        if (isBold) {
          const inner = part.slice(2, -2);
          return (
            <strong key={index} className="font-semibold text-foreground">
              {inner}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};
