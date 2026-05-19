import type { JSX } from 'react';
import { useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SceneWidget } from '../features/scene/widget/scene/SceneWidget';
import { ShipSelectorWidget } from '../features/ships/widget/selector/ShipSelectorWidget';
import { parseShipSearch } from '../features/ships/schema/shipSearch';
import { lookupShip } from '../features/ships/types/shipRegistry';
import type { ShipId, ShipSelection } from '../features/ships/types/ship';

export const Route = createFileRoute('/')({
  validateSearch: parseShipSearch,
  component: IndexPage,
});

export const toSelection = (shipId: ShipId | undefined): ShipSelection =>
  shipId === undefined
    ? { kind: 'unselected' }
    : { kind: 'selected', ship: lookupShip(shipId) };

function IndexPage(): JSX.Element {
  const { ship } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selection = toSelection(ship);

  const onPick = useCallback(
    (id: ShipId): void => {
      void navigate({ search: { ship: id } });
    },
    [navigate],
  );

  switch (selection.kind) {
    case 'unselected':
      return <ShipSelectorWidget onPick={onPick} />;
    case 'selected':
      return <SceneWidget ship={selection.ship} />;
  }
}
