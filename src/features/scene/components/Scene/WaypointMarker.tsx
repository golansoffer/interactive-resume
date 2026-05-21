import type { CSSProperties, JSX, RefObject } from 'react';
import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Kinematics } from '../../types/kinematics';
import type { RouteProjection } from '../../types/route-projection';
import { targetFor } from '../../services/renderer/projectMarker';
import { clampToEdge, isInsideNdc, projectToNdc } from '../../services/renderer/ndcProjection';

type WaypointMarkerProps = {
  readonly projection: RouteProjection;
  readonly kinematicsRef: RefObject<Kinematics>;
};

type MarkerView =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'visible';
      readonly edgeX: number;
      readonly edgeY: number;
      readonly distance: number;
    };

type NdcSnapshot = { readonly x: number; readonly y: number; readonly distance: number };

const distanceBetween = (
  a: { readonly x: number; readonly y: number; readonly z: number },
  b: readonly [number, number, number],
): number => Math.hypot(a.x - b[0], a.y - b[1], a.z - b[2]);

const NDC_SETTLE_EPSILON = 0.005;
const DISTANCE_SETTLE_EPSILON = 0.5;

const isSettled = (last: NdcSnapshot | null, ndc: readonly [number, number], distance: number): boolean => {
  if (last === null) return false;
  return (
    Math.abs(last.x - ndc[0]) < NDC_SETTLE_EPSILON &&
    Math.abs(last.y - ndc[1]) < NDC_SETTLE_EPSILON &&
    Math.abs(last.distance - distance) < DISTANCE_SETTLE_EPSILON
  );
};

const PILL_STYLE: CSSProperties = {
  pointerEvents: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '4px 10px',
  borderRadius: '999px',
  backgroundColor: 'rgba(10, 13, 24, 0.78)',
  border: '1px solid rgba(95, 214, 255, 0.45)',
  color: '#aeefff',
  font: '600 10px / 1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const CHEVRON_STYLE: CSSProperties = {
  display: 'inline-block',
  width: '12px',
  height: '12px',
  borderTop: '2px solid #5fd6ff',
  borderRight: '2px solid #5fd6ff',
};

const computeChevronRotation = (edgeX: number, edgeY: number): number => {
  const radians = Math.atan2(edgeY, edgeX);
  return -(radians * 180) / Math.PI - 45;
};

type VisibleView = { readonly edgeX: number; readonly edgeY: number; readonly distance: number };

const MarkerPill = ({ view }: { readonly view: VisibleView }): JSX.Element => (
  <Html fullscreen transform={false} prepend>
    <div
      style={{
        position: 'absolute',
        left: `${((view.edgeX + 1) / 2) * 100}%`,
        top: `${((1 - view.edgeY) / 2) * 100}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    >
      <div style={PILL_STYLE}>
        <span
          style={{
            ...CHEVRON_STYLE,
            transform: `rotate(${computeChevronRotation(view.edgeX, view.edgeY)}deg)`,
          }}
        />
        <span>{Math.round(view.distance)} m</span>
      </div>
    </div>
  </Html>
);

export const WaypointMarker = (props: WaypointMarkerProps): JSX.Element | null => {
  const camera = useThree((three) => three.camera);
  const active = useMemo(() => targetFor(props.projection), [props.projection]);
  const [view, setView] = useState<MarkerView>({ kind: 'hidden' });
  const lastNdcRef = useRef<NdcSnapshot | null>(null);

  useFrame(() => {
    if (active.kind === 'none') {
      if (view.kind !== 'hidden') setView({ kind: 'hidden' });
      lastNdcRef.current = null;
      return;
    }
    const target = active.target;
    const ndc = projectToNdc(target.placement, camera);
    if (isInsideNdc(ndc)) {
      if (view.kind !== 'hidden') setView({ kind: 'hidden' });
      lastNdcRef.current = null;
      return;
    }
    const playerPos = props.kinematicsRef.current.position;
    const distance = distanceBetween(playerPos, target.placement);
    if (isSettled(lastNdcRef.current, ndc, distance)) return;
    const { edgeX, edgeY } = clampToEdge(ndc[0], ndc[1]);
    lastNdcRef.current = { x: ndc[0], y: ndc[1], distance };
    setView({ kind: 'visible', edgeX, edgeY, distance });
  });

  if (view.kind === 'hidden') return null;
  return <MarkerPill view={view} />;
};
