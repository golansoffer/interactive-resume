export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type YearMonth = {
  readonly year: number;
  readonly month: Month;
};

export type Period =
  | { readonly kind: 'closed'; readonly start: YearMonth; readonly end: YearMonth }
  | { readonly kind: 'ongoing'; readonly start: YearMonth };
