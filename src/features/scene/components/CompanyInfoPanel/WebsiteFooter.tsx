import type { JSX } from 'react';
import { ExternalLink } from 'lucide-react';
import { CardFooter } from '@/components/ui/card';

type WebsiteFooterProps = {
  readonly url: string;
};

const displayHost = (url: string): string =>
  url.replace(/^https?:\/\//u, '').replace(/^www\./u, '').replace(/\/$/u, '');

const WebsiteLink = ({ url }: { readonly url: string }): JSX.Element => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer noopener"
    className="pointer-events-auto group inline-flex items-center gap-1.5 rounded-sm text-xs font-medium tracking-wide text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
  >
    <span>{displayHost(url)}</span>
    <ExternalLink
      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
      aria-hidden="true"
    />
  </a>
);

export const WebsiteFooter = ({ url }: WebsiteFooterProps): JSX.Element => (
  <CardFooter data-section="footer" className="border-t-0 bg-transparent p-0">
    <div className="flex w-full items-center justify-end px-5 pb-4 pt-6">
      <WebsiteLink url={url} />
    </div>
  </CardFooter>
);
