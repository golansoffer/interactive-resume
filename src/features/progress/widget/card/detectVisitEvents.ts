import type { Pip } from '../../types/pip';
import type { PipTuple, ProgressProjection } from '../../types/progress-projection';
import type { VisitEvent } from '../../types/visit-event';

type Transition = {
  readonly index: number;
  readonly prev: Pip['kind'];
  readonly next: Pip['kind'];
  readonly pip: Pip;
};

const transitionsBetween = (prev: PipTuple, next: PipTuple): ReadonlyArray<Transition> => {
  const transitions: Transition[] = [];
  const pairs: ReadonlyArray<readonly [Pip, Pip, number]> = [
    [prev[0], next[0], 0],
    [prev[1], next[1], 1],
    [prev[2], next[2], 2],
    [prev[3], next[3], 3],
    [prev[4], next[4], 4],
  ];
  for (const [prevPip, nextPip, index] of pairs) {
    if (prevPip.kind !== nextPip.kind) {
      transitions.push({ index, prev: prevPip.kind, next: nextPip.kind, pip: nextPip });
    }
  }
  return transitions;
};

const firstVisitEvent = (
  pip: Pip,
  nextCounter: ProgressProjection['counter'],
): VisitEvent =>
  nextCounter.kind === 'complete'
    ? { kind: 'route_complete', companyId: pip.companyId, assetId: pip.assetId }
    : { kind: 'first_visit', companyId: pip.companyId, assetId: pip.assetId };

const eventForTransitions = (
  transitions: ReadonlyArray<Transition>,
  nextCounter: ProgressProjection['counter'],
): VisitEvent | null => {
  // Priority: a new "here" (first_visit/route_complete or revisit) outweighs
  // a depart (here→visited in the same tick).
  for (const t of transitions) {
    if (t.next === 'here' && t.prev === 'unvisited') {
      return firstVisitEvent(t.pip, nextCounter);
    }
    if (t.next === 'here' && t.prev === 'visited') {
      return { kind: 'revisit', companyId: t.pip.companyId, assetId: t.pip.assetId };
    }
  }
  for (const t of transitions) {
    if (t.prev === 'here' && t.next === 'visited') {
      return { kind: 'depart', companyId: t.pip.companyId, assetId: t.pip.assetId };
    }
  }
  return null;
};

export const detectVisitEvents = (
  prev: ProgressProjection,
  next: ProgressProjection,
): VisitEvent | null => {
  const transitions = transitionsBetween(prev.pips, next.pips);
  if (transitions.length === 0) return null;
  return eventForTransitions(transitions, next.counter);
};
