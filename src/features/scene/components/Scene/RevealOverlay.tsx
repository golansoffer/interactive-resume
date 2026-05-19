import type { CSSProperties, JSX } from 'react';
import { Html } from '@react-three/drei';
import type { CompanyInfo } from '../../types/company-info';
import type { Month, Period, YearMonth } from '../../types/period';

type RevealOverlayProps = {
  readonly info: CompanyInfo;
  readonly placement: readonly [number, number, number];
};

const REVEAL_OFFSET_Y = 3.5;

const CARD_STYLE: CSSProperties = {
  pointerEvents: 'none',
  transform: 'translate(-50%, -100%)',
  background: 'rgba(8, 12, 24, 0.92)',
  color: '#ffffff',
  padding: '12px 16px',
  borderRadius: '8px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '13px',
  lineHeight: 1.45,
  maxWidth: '320px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.45)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
};

const HEADING_STYLE: CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  marginBottom: '4px',
};

const META_STYLE: CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255, 255, 255, 0.72)',
  marginBottom: '8px',
};

const monthName = (month: Month): string => {
  switch (month) {
    case 1: return 'Jan';
    case 2: return 'Feb';
    case 3: return 'Mar';
    case 4: return 'Apr';
    case 5: return 'May';
    case 6: return 'Jun';
    case 7: return 'Jul';
    case 8: return 'Aug';
    case 9: return 'Sep';
    case 10: return 'Oct';
    case 11: return 'Nov';
    case 12: return 'Dec';
  }
};

const formatYearMonth = (ym: YearMonth): string =>
  `${monthName(ym.month)} ${ym.year}`;

const formatPeriod = (period: Period): string => {
  switch (period.kind) {
    case 'ongoing':
      return `${formatYearMonth(period.start)} – Present`;
    case 'closed':
      return `${formatYearMonth(period.start)} – ${formatYearMonth(period.end)}`;
  }
};

export const RevealOverlay = (props: RevealOverlayProps): JSX.Element => {
  const [x, y, z] = props.placement;
  const position: readonly [number, number, number] = [x, y + REVEAL_OFFSET_Y, z];

  return (
    <Html position={position} center>
      <div style={CARD_STYLE}>
        <div style={HEADING_STYLE}>{props.info.role}</div>
        <div style={META_STYLE}>{formatPeriod(props.info.period)}</div>
        <div>{props.info.description}</div>
      </div>
    </Html>
  );
};
