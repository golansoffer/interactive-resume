import type { CompanyEntry, CompanyId } from '../../types/company';
import type { PlacedTarget, RouteProjection } from '../../types/route-projection';

// Non-empty route — the type itself carries the proof that route[0] is total
// CompanyEntry (not CompanyEntry | undefined). No "should never happen" guards
// on emptiness anywhere downstream.
type Route = readonly [CompanyEntry, ...ReadonlyArray<CompanyEntry>];

const placedTargetFor = (entry: CompanyEntry): PlacedTarget => ({
  id: entry.id,
  placement: entry.planet.placement,
});

// Anchor view = "what is the most-recently-visited entry on the route".
// Discriminated union — no anchor when visited is empty, otherwise anchor.
type AnchorView =
  | { readonly kind: 'no_anchor' }
  | { readonly kind: 'anchor'; readonly target: PlacedTarget };

// Iterate visited forward (oldest → newest). On each match in the route,
// overwrite the running anchor — the last match wins, which by visit order
// IS the most-recently-visited route entry. Both loops use for...of on
// arrays/tuples — each iteration variable is the element value directly
// (CompanyId or CompanyEntry), never a lookup-shaped expression.
const anchorViewFor = (visited: ReadonlyArray<CompanyId>, route: Route): AnchorView => {
  let view: AnchorView = { kind: 'no_anchor' };
  for (const visitedId of visited) {
    for (const entry of route) {
      if (entry.id === visitedId) {
        view = { kind: 'anchor', target: placedTargetFor(entry) };
      }
    }
  }
  return view;
};

// Next view = "what is the first route entry the player has not yet visited".
// 'all_done' when every route entry has been visited.
type NextView =
  | { readonly kind: 'all_done' }
  | { readonly kind: 'next'; readonly target: PlacedTarget };

const nextViewFor = (visitedSet: ReadonlySet<CompanyId>, route: Route): NextView => {
  for (const entry of route) {
    if (!visitedSet.has(entry.id)) return { kind: 'next', target: placedTargetFor(entry) };
  }
  return { kind: 'all_done' };
};

export const projectRoute = (visited: ReadonlyArray<CompanyId>, route: Route): RouteProjection => {
  const anchor = anchorViewFor(visited, route);
  if (anchor.kind === 'no_anchor') {
    // route[0] is total CompanyEntry — route is typed as a non-empty tuple.
    return { kind: 'pre_route', firstTarget: placedTargetFor(route[0]) };
  }
  const next = nextViewFor(new Set(visited), route);
  if (next.kind === 'all_done') {
    return { kind: 'complete', anchor: anchor.target };
  }
  return { kind: 'mid_route', anchor: anchor.target, nextTarget: next.target };
};
