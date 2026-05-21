import type { Period } from './period';

export type CompanyLogo =
  | { readonly kind: 'with_icon'; readonly src: string; readonly backdrop: 'light' | 'dark' }
  | { readonly kind: 'text_label'; readonly text: string; readonly backdrop: 'light' | 'dark' }
  | { readonly kind: 'no_icon' };

export type CompanyWebsite =
  | { readonly kind: 'has_website'; readonly url: string }
  | { readonly kind: 'no_website' };

export type CompanyDecision =
  | { readonly kind: 'recorded'; readonly text: string }
  | { readonly kind: 'none' };

export type CompanyDeparture =
  | { readonly kind: 'current_role' }
  | { readonly kind: 'moved_on'; readonly text: string }
  | { readonly kind: 'undisclosed' };

export type CompanyInfo = {
  readonly companyName: string;
  readonly logo: CompanyLogo;
  readonly website: CompanyWebsite;
  readonly role: string;
  readonly period: Period;
  readonly oneLiner: string;
  readonly hook: string;
  readonly decision: CompanyDecision;
  readonly work: ReadonlyArray<string>;
  readonly departure: CompanyDeparture;
};
