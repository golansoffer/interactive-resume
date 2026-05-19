import { useCallback, useState } from 'react';
import { ALL_SHIPS } from '../../types/shipRegistry';
import type { ShipEntry, ShipHover, ShipId } from '../../types/ship';

type UseShipSelectorResult = {
  readonly ships: ReadonlyArray<ShipEntry>;
  readonly hover: ShipHover;
  readonly onHoverEnter: (id: ShipId) => void;
  readonly onHoverLeave: () => void;
};

const NO_HOVER: ShipHover = { kind: 'none' };

export const useShipSelector = (): UseShipSelectorResult => {
  const [hover, setHover] = useState<ShipHover>(NO_HOVER);
  const onHoverEnter = useCallback((id: ShipId): void => {
    setHover({ kind: 'hovering', id });
  }, []);
  const onHoverLeave = useCallback((): void => {
    setHover(NO_HOVER);
  }, []);
  return { ships: ALL_SHIPS, hover, onHoverEnter, onHoverLeave };
};
