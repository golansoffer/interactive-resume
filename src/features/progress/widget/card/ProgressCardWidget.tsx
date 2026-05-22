import type { JSX } from 'react';
import type { CompanyEntry, CompanyId } from '../../../scene/types/company';
import type { SceneState } from '../../../scene/types/scene-state';
import { ProgressCard } from '../../components/ProgressCard/ProgressCard';
import { useProgress } from './useProgress';

type Route = readonly [CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry];

type ProgressCardWidgetProps = {
  readonly state: SceneState;
  readonly visited: ReadonlyArray<CompanyId>;
  readonly route: Route;
};

export const ProgressCardWidget = (props: ProgressCardWidgetProps): JSX.Element => {
  const { projection, visitEvent, motion, visibility } = useProgress({
    state: props.state,
    visited: props.visited,
    route: props.route,
  });
  return (
    <ProgressCard
      projection={projection}
      visitEvent={visitEvent}
      motion={motion}
      visibility={visibility}
    />
  );
};
