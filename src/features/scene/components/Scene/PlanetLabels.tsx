import type { CSSProperties, JSX, ReactNode } from 'react';
import { Html } from '@react-three/drei';
import { assetUrl } from '@/lib/assetUrl';
import type { LabelProjection } from '../../types/projections';

type PlanetLabelsProps = {
  readonly labels: ReadonlyArray<LabelProjection>;
};

const LABEL_OFFSET_Y = -8.0;
const LABEL_DISTANCE_FACTOR = 30;

const PLATE_BASE_STYLE: CSSProperties = {
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '144px',
  height: '48px',
  borderRadius: '8px',
  boxShadow: '0 1px 6px rgba(0, 0, 0, 0.45)',
};

const LIGHT_PLATE_STYLE: CSSProperties = {
  ...PLATE_BASE_STYLE,
  backgroundColor: 'rgba(248, 249, 252, 0.96)',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  color: '#111827',
};

const DARK_PLATE_STYLE: CSSProperties = {
  ...PLATE_BASE_STYLE,
  backgroundColor: 'rgba(10, 13, 24, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  color: '#ffffff',
};

const ICON_STYLE: CSSProperties = {
  width: '120px',
  height: '32px',
  objectFit: 'contain',
  maxWidth: 'none',
  display: 'block',
};

const TEXT_STYLE: CSSProperties = {
  width: '120px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: '"Geist Variable", system-ui, -apple-system, "Segoe UI", sans-serif',
  fontWeight: 700,
  fontSize: '22px',
  letterSpacing: '0.04em',
  lineHeight: 1,
};

const plateStyleFor = (backdrop: 'light' | 'dark'): CSSProperties =>
  backdrop === 'light' ? LIGHT_PLATE_STYLE : DARK_PLATE_STYLE;

const renderLabelBody = (label: LabelProjection): ReactNode => {
  switch (label.kind) {
    case 'icon':
      return <img src={assetUrl(label.iconSrc)} alt="" style={ICON_STYLE} />;
    case 'text':
      return <span style={TEXT_STYLE}>{label.text}</span>;
  }
};

export const PlanetLabels = (props: PlanetLabelsProps): JSX.Element => (
  <group>
    {props.labels.map((label) => {
      const [x, y, z] = label.placement;
      const position: readonly [number, number, number] = [x, y + LABEL_OFFSET_Y, z];
      return (
        <Html key={label.id} position={position} center distanceFactor={LABEL_DISTANCE_FACTOR}>
          <div data-backdrop={label.backdrop} style={plateStyleFor(label.backdrop)}>
            {renderLabelBody(label)}
          </div>
        </Html>
      );
    })}
  </group>
);
