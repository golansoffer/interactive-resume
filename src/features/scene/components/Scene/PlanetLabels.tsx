import type { CSSProperties, JSX } from 'react';
import { Html } from '@react-three/drei';
import type { LabelProjection } from '../../types/projections';

type PlanetLabelsProps = {
  readonly labels: ReadonlyArray<LabelProjection>;
};

const LABEL_OFFSET_Y = 2.5;

const LABEL_CONTAINER_STYLE: CSSProperties = {
  pointerEvents: 'none',
  transform: 'translate(-50%, -100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: '#ffffff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px',
  textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
  whiteSpace: 'nowrap',
};

const LOGO_STYLE: CSSProperties = {
  width: '32px',
  height: '32px',
  marginBottom: '4px',
};

export const PlanetLabels = (props: PlanetLabelsProps): JSX.Element => (
  <group>
    {props.labels.map((label) => {
      const [x, y, z] = label.placement;
      const position: readonly [number, number, number] = [x, y + LABEL_OFFSET_Y, z];
      return (
        <Html key={label.id} position={position} center>
          <div style={LABEL_CONTAINER_STYLE}>
            <img src={label.logoSrc} alt="" style={LOGO_STYLE} />
            <span>{label.companyName}</span>
          </div>
        </Html>
      );
    })}
  </group>
);
