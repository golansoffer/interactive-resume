import type { Period } from './period';

export type CompanyInfo = {
  readonly companyName: string;
  readonly logoSrc: string;
  readonly role: string;
  readonly period: Period;
  readonly description: string;
};
