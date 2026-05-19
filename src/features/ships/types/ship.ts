export const SHIP_IDS = [
  'speederA',
  'cargoA',
  'cargoB',
  'racer',
  'miner',
] as const;

export type ShipId = (typeof SHIP_IDS)[number];

export type ShipEntry = {
  readonly id: ShipId;
  readonly displayName: string;
  readonly glbPath: string;
  readonly scale: number;
};

export type ShipSelection =
  | { readonly kind: 'unselected' }
  | { readonly kind: 'selected'; readonly ship: ShipEntry };

export type ShipHover =
  | { readonly kind: 'none' }
  | { readonly kind: 'hovering'; readonly id: ShipId };
