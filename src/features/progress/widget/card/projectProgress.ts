import type { CompanyEntry, CompanyId } from '../../../scene/types/company';
import type { PausedResume, SceneState } from '../../../scene/types/scene-state';
import type { Counter } from '../../types/counter';
import type { Headline, HeadlineCompany } from '../../types/headline';
import type { Pip } from '../../types/pip';
import type { PipTuple, ProgressProjection } from '../../types/progress-projection';
import type { StatusLabel } from '../../types/status-label';

type Route = readonly [CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry];

type ActiveView =
  | { readonly kind: 'no_active' }
  | { readonly kind: 'active'; readonly objectId: CompanyId };

const activeViewFromPaused = (resumeTo: PausedResume): ActiveView => {
  switch (resumeTo.kind) {
    case 'revealing':
      return { kind: 'active', objectId: resumeTo.objectId };
    case 'playing':
      return { kind: 'no_active' };
  }
};

const activeViewOf = (state: SceneState): ActiveView => {
  switch (state.kind) {
    case 'revealing':
      return { kind: 'active', objectId: state.objectId };
    case 'paused':
      return activeViewFromPaused(state.resumeTo);
    case 'playing':
    case 'loading':
      return { kind: 'no_active' };
  }
};

const headlineCompanyFor = (entry: CompanyEntry): HeadlineCompany => ({
  id: entry.id,
  assetId: entry.planet.assetId,
  shortCode: entry.shortCode,
});

const lookupEntry = (route: Route, id: CompanyId): CompanyEntry | null => {
  for (const entry of route) {
    if (entry.id === id) return entry;
  }
  return null;
};

const lastVisitedEntry = (
  visited: ReadonlyArray<CompanyId>,
  route: Route,
): CompanyEntry | null => {
  for (let i = visited.length - 1; i >= 0; i--) {
    const id = visited[i];
    if (id === undefined) continue;
    const entry = lookupEntry(route, id);
    if (entry !== null) return entry;
  }
  return null;
};

const headlineFor = (
  state: SceneState,
  visited: ReadonlyArray<CompanyId>,
  route: Route,
): Headline => {
  const active = activeViewOf(state);
  if (active.kind === 'active') {
    const entry = lookupEntry(route, active.objectId);
    if (entry === null) return { kind: 'empty' };
    return { kind: 'active', company: headlineCompanyFor(entry) };
  }
  const last = lastVisitedEntry(visited, route);
  if (last === null) return { kind: 'empty' };
  const visitedSet = new Set(visited);
  const allVisited = route.every((entry) => visitedSet.has(entry.id));
  return {
    kind: allVisited ? 'complete' : 'anchor',
    company: headlineCompanyFor(last),
  };
};

const statusFor = (headline: Headline): StatusLabel => {
  switch (headline.kind) {
    case 'empty':
      return { kind: 'standby' };
    case 'active':
      return { kind: 'active' };
    case 'anchor':
      return { kind: 'last_explored' };
    case 'complete':
      return { kind: 'route_complete' };
  }
};

const counterFor = (visited: ReadonlyArray<CompanyId>, route: Route): Counter => {
  const visitedSet = new Set(visited);
  let count = 0;
  for (const entry of route) {
    if (visitedSet.has(entry.id)) count++;
  }
  const total = route.length;
  if (count === total) return { kind: 'complete', total };
  return { kind: 'idle', visited: count, total };
};

const pipFor = (
  entry: CompanyEntry,
  visitedSet: ReadonlySet<CompanyId>,
  activeId: CompanyId | null,
): Pip => {
  if (activeId !== null && entry.id === activeId) {
    return { kind: 'here', companyId: entry.id, assetId: entry.planet.assetId };
  }
  if (visitedSet.has(entry.id)) {
    return { kind: 'visited', companyId: entry.id, assetId: entry.planet.assetId };
  }
  return { kind: 'unvisited', companyId: entry.id, assetId: entry.planet.assetId };
};

const pipsFor = (
  state: SceneState,
  visited: ReadonlyArray<CompanyId>,
  route: Route,
): PipTuple => {
  const active = activeViewOf(state);
  const activeId = active.kind === 'active' ? active.objectId : null;
  const visitedSet = new Set(visited);
  return [
    pipFor(route[0], visitedSet, activeId),
    pipFor(route[1], visitedSet, activeId),
    pipFor(route[2], visitedSet, activeId),
    pipFor(route[3], visitedSet, activeId),
    pipFor(route[4], visitedSet, activeId),
  ];
};

export const projectProgress = (
  state: SceneState,
  visited: ReadonlyArray<CompanyId>,
  route: Route,
): ProgressProjection => {
  const headline = headlineFor(state, visited, route);
  return {
    headline,
    status: statusFor(headline),
    counter: counterFor(visited, route),
    pips: pipsFor(state, visited, route),
  };
};
