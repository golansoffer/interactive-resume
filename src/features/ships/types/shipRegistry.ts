import { SHIP_IDS } from './ship';
import type { ShipEntry, ShipId } from './ship';

export const SHIP_REGISTRY: Readonly<Record<ShipId, ShipEntry>> = {
  speederA: { id: 'speederA', displayName: 'Speeder A', glbPath: '/models/kenney-space-kit/craft_speederA.glb', scale: 0.6 },
  cargoA:   { id: 'cargoA',   displayName: 'Cargo A',   glbPath: '/models/kenney-space-kit/craft_cargoA.glb',   scale: 0.5 },
  cargoB:   { id: 'cargoB',   displayName: 'Cargo B',   glbPath: '/models/kenney-space-kit/craft_cargoB.glb',   scale: 0.5 },
  racer:    { id: 'racer',    displayName: 'Racer',     glbPath: '/models/kenney-space-kit/craft_racer.glb',    scale: 0.6 },
  miner:    { id: 'miner',    displayName: 'Miner',     glbPath: '/models/kenney-space-kit/craft_miner.glb',    scale: 0.55 },
};

export const lookupShip = (id: ShipId): ShipEntry => SHIP_REGISTRY[id];

export const ALL_SHIPS: ReadonlyArray<ShipEntry> = SHIP_IDS.map((id) => SHIP_REGISTRY[id]);
