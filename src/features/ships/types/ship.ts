export const SHIP_IDS = [
  'speederA',
  'speederB',
  'speederC',
  'speederD',
  'cargoA',
  'cargoB',
  'racer',
  'miner',
] as const;

export type ShipId = (typeof SHIP_IDS)[number];

export const DEFAULT_SHIP_ID: ShipId = 'speederA';

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

// The hero stage always has a ship visible. During a swap, both the
// outgoing and incoming ships are mounted and crossfade; once the
// transition window closes the phase collapses back to `stable`.
export type HeroPhase =
  | { readonly kind: 'stable'; readonly current: ShipEntry }
  | {
      readonly kind: 'transitioning';
      readonly outgoing: ShipEntry;
      readonly incoming: ShipEntry;
      readonly startedAt: number;
    };

// Short uppercase code used by HUD ("SPD-A" etc.). Exhaustive switch — TS
// guarantees coverage as new ShipIds are added; no fallback, no default.
export const shipCode = (id: ShipId): string => {
  switch (id) {
    case 'speederA':
      return 'SPD-A';
    case 'speederB':
      return 'SPD-B';
    case 'speederC':
      return 'SPD-C';
    case 'speederD':
      return 'SPD-D';
    case 'cargoA':
      return 'CRG-A';
    case 'cargoB':
      return 'CRG-B';
    case 'racer':
      return 'RAC';
    case 'miner':
      return 'MIN';
  }
};
