import type { JSX } from 'react';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
} from 'three';
import type { RouteProjection } from '../../types/route-projection';
import { cuesFor } from '../../services/renderer/projectBeam';

type WaypointBeamProps = {
  readonly projection: RouteProjection;
};

const BEAM_COLOR = '#5fd6ff';
const BEAM_BASE_OPACITY = 0.25;
const BEAM_PULSE_AMPLITUDE = 0.12;
const BEAM_PULSE_HZ = 0.12;
const TWO_PI = Math.PI * 2;

type BeamHandle =
  | { readonly kind: 'silent' }
  | {
      readonly kind: 'visible';
      readonly line: LineSegments;
      readonly material: LineBasicMaterial;
    };

const makeLine = (
  start: readonly [number, number, number],
  end: readonly [number, number, number],
): { readonly line: LineSegments; readonly material: LineBasicMaterial } => {
  const geometry = new BufferGeometry();
  const positions = new Float32Array([start[0], start[1], start[2], end[0], end[1], end[2]]);
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color: new Color(BEAM_COLOR),
    transparent: true,
    opacity: BEAM_BASE_OPACITY,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const line = new LineSegments(geometry, material);
  line.renderOrder = 2;
  return { line, material };
};

const useBeamPulse = (handle: BeamHandle): void => {
  useFrame((state) => {
    switch (handle.kind) {
      case 'silent':
        return;
      case 'visible': {
        const pulse = Math.sin(state.clock.elapsedTime * BEAM_PULSE_HZ * TWO_PI);
        handle.material.opacity = BEAM_BASE_OPACITY + pulse * BEAM_PULSE_AMPLITUDE;
      }
    }
  });
};

export const WaypointBeam = (props: WaypointBeamProps): JSX.Element | null => {
  const cues = useMemo(() => cuesFor(props.projection), [props.projection]);

  const handle = useMemo<BeamHandle>(() => {
    if (cues.kind === 'silent') return { kind: 'silent' };
    return { kind: 'visible', ...makeLine(cues.start, cues.end) };
  }, [cues]);

  useBeamPulse(handle);

  switch (handle.kind) {
    case 'silent':
      return null;
    case 'visible':
      return <primitive object={handle.line} />;
  }
};
