import type { JSX } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SceneWidget } from '../features/scene/widget/scene/SceneWidget';
import { lookupShip } from '../features/ships/types/shipRegistry';
import type { ShipId, ShipSelection } from '../features/ships/types/ship';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

export const toSelection = (shipId: ShipId | undefined): ShipSelection =>
  shipId === undefined
    ? { kind: 'unselected' }
    : { kind: 'selected', ship: lookupShip(shipId) };

function IndexPage(): JSX.Element {
  return <SceneWidget />;
}
