import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompanyEntry, CompanyId } from '../../../scene/types/company';
import type { SceneState } from '../../../scene/types/scene-state';
import { subscribePrefersReducedMotion } from '../../../comms/services/prefersReducedMotion';
import type { MotionPreference } from '../../../comms/types/motion-preference';
import type { ProgressProjection } from '../../types/progress-projection';
import type { ProgressVisibility } from '../../types/progress-visibility';
import type { VisitEvent } from '../../types/visit-event';
import { detectVisitEvents } from './detectVisitEvents';
import { projectProgress } from './projectProgress';
import { projectVisibility } from './projectVisibility';

type Route = readonly [CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry, CompanyEntry];

type UseProgressInput = {
  readonly state: SceneState;
  readonly visited: ReadonlyArray<CompanyId>;
  readonly route: Route;
};

export type UseProgressResult = {
  readonly projection: ProgressProjection;
  readonly visitEvent: VisitEvent | null;
  readonly motion: MotionPreference;
  readonly visibility: ProgressVisibility;
};

const REGULAR_WINDOW_MS = 1100;
const COMPLETE_WINDOW_MS = 1500;
const REVISIT_WINDOW_MS = 600;

const windowFor = (event: VisitEvent): number => {
  switch (event.kind) {
    case 'first_visit':
      return REGULAR_WINDOW_MS;
    case 'route_complete':
      return COMPLETE_WINDOW_MS;
    case 'revisit':
    case 'depart':
      return REVISIT_WINDOW_MS;
  }
};

export const useProgress = (input: UseProgressInput): UseProgressResult => {
  const projection = useMemo(
    () => projectProgress(input.state, input.visited, input.route),
    [input.state, input.visited, input.route],
  );

  const prevProjectionRef = useRef<ProgressProjection>(projection);
  const [visitEvent, setVisitEvent] = useState<VisitEvent | null>(null);
  const [motion, setMotion] = useState<MotionPreference>({ kind: 'normal' });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevProjectionRef.current;
    if (prev === projection) return;
    const event = detectVisitEvents(prev, projection);
    prevProjectionRef.current = projection;
    if (event === null) return;

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setVisitEvent(event);
    const ms = windowFor(event);
    timerRef.current = setTimeout(() => {
      setVisitEvent(null);
      timerRef.current = null;
    }, ms);
  }, [projection]);

  useEffect(() => {
    const unsubscribe = subscribePrefersReducedMotion((pref) => setMotion(pref));
    return unsubscribe;
  }, []);

  useEffect(
    () => (): void => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const visibility = useMemo(() => projectVisibility(input.state), [input.state]);

  return { projection, visitEvent, motion, visibility };
};
