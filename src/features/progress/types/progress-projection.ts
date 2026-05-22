import type { Counter } from './counter';
import type { Headline } from './headline';
import type { Pip } from './pip';
import type { StatusLabel } from './status-label';

export type PipTuple = readonly [Pip, Pip, Pip, Pip, Pip];

export type ProgressProjection = {
  readonly headline: Headline;
  readonly status: StatusLabel;
  readonly counter: Counter;
  readonly pips: PipTuple;
};
