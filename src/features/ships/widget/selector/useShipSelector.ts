import { useCallback, useEffect, useRef, useState } from 'react';
import { HERO_TRANSITION_MS } from '../../components/ShipSelector/tickRotation';
import { ALL_SHIPS, lookupShip } from '../../types/shipRegistry';
import {
  DEFAULT_SHIP_ID,
  type HeroPhase,
  type ShipEntry,
  type ShipHover,
  type ShipId,
} from '../../types/ship';

type UseShipSelectorResult = {
  readonly ships: ReadonlyArray<ShipEntry>;
  readonly hover: ShipHover;
  readonly heroPhase: HeroPhase;
  readonly onHoverEnter: (id: ShipId) => void;
  readonly onHoverLeave: () => void;
};

const NO_HOVER: ShipHover = { kind: 'none' };
const INITIAL_SHIP: ShipEntry = lookupShip(DEFAULT_SHIP_ID);
const INITIAL_PHASE: HeroPhase = { kind: 'stable', current: INITIAL_SHIP };

// The "currently visible" ship at the front of the stack — used to decide
// whether a hover change requires a fresh transition. During a swap this
// is the incoming ship (the one that's animating in / will land); when
// stable it's the lone current ship.
const visibleShip = (phase: HeroPhase): ShipEntry => {
  switch (phase.kind) {
    case 'stable':
      return phase.current;
    case 'transitioning':
      return phase.incoming;
  }
};

const targetFor = (hover: ShipHover): ShipEntry =>
  hover.kind === 'hovering' ? lookupShip(hover.id) : INITIAL_SHIP;

export const useShipSelector = (): UseShipSelectorResult => {
  const [hover, setHover] = useState<ShipHover>(NO_HOVER);
  const [heroPhase, setHeroPhase] = useState<HeroPhase>(INITIAL_PHASE);
  const phaseRef = useRef<HeroPhase>(heroPhase);
  phaseRef.current = heroPhase;

  useEffect(() => {
    const target = targetFor(hover);
    const visible = visibleShip(phaseRef.current);
    if (visible.id === target.id) return;
    setHeroPhase({
      kind: 'transitioning',
      outgoing: visible,
      incoming: target,
      startedAt: performance.now(),
    });
    const timer = window.setTimeout(() => {
      setHeroPhase({ kind: 'stable', current: target });
    }, HERO_TRANSITION_MS);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [hover]);

  const onHoverEnter = useCallback((id: ShipId): void => {
    setHover({ kind: 'hovering', id });
  }, []);
  const onHoverLeave = useCallback((): void => {
    setHover(NO_HOVER);
  }, []);

  return { ships: ALL_SHIPS, hover, heroPhase, onHoverEnter, onHoverLeave };
};
