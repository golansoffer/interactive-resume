import type { Period } from './period';

export type CompanyLogo =
  | { readonly kind: 'with_icon'; readonly src: string; readonly backdrop: 'light' | 'dark' }
  | { readonly kind: 'no_icon' };

export type CompanyWebsite =
  | { readonly kind: 'has_website'; readonly url: string }
  | { readonly kind: 'no_website' };

export type CompanyInfo = {
  readonly companyName: string;
  readonly logo: CompanyLogo;
  readonly website: CompanyWebsite;
  readonly role: string;
  readonly period: Period;
  readonly description: string;
};
