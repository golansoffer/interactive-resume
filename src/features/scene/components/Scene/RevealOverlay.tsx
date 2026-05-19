import type { JSX } from 'react';
import { Html } from '@react-three/drei';
import type { CompanyId } from '../../types/company';

type RevealOverlayProps = {
  readonly objectId: CompanyId;
};

export const RevealOverlay = (_props: RevealOverlayProps): JSX.Element => (
  <Html />
);
