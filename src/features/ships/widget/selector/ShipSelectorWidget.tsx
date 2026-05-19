import type { CSSProperties, JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, View } from '@react-three/drei';
import { cn } from '@/lib/utils';
import { ShipSelector } from '../../components/ShipSelector/ShipSelector';
import { ALL_SHIPS } from '../../types/shipRegistry';
import type { ShipId } from '../../types/ship';
import { useShipSelector } from './useShipSelector';

type ShipSelectorWidgetProps = {
  readonly onPick: (id: ShipId) => void;
};

const CANVAS_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
};

const containerClassName = cn(
  'relative flex h-screen w-screen flex-col items-center justify-center gap-8',
  'bg-[--color-bg] text-[--color-fg] p-8 overflow-auto',
);
const titleClassName = 'text-3xl font-semibold tracking-tight';

export const ShipSelectorWidget = (props: ShipSelectorWidgetProps): JSX.Element => {
  const { ships, hover, onHoverEnter, onHoverLeave } = useShipSelector();
  return (
    <div className={containerClassName}>
      <h1 className={titleClassName}>Choose your ship</h1>
      <ShipSelector
        ships={ships}
        hover={hover}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        onPick={props.onPick}
      />
      <Canvas style={CANVAS_STYLE} dpr={[1, 2]}>
        <View.Port />
      </Canvas>
    </div>
  );
};

// Side-effect preload: when this module loads, all 8 GLBs start fetching.
// By the time the user picks, the chosen GLB is already cached.
for (const ship of ALL_SHIPS) useGLTF.preload(ship.glbPath);
