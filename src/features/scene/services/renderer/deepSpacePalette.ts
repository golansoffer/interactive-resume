export type NebulaPalette = {
  readonly base: readonly [number, number, number];
  readonly accent: readonly [number, number, number];
  readonly highlight: readonly [number, number, number];
};

export const DEFAULT_PALETTE: NebulaPalette = {
  base: [0.06, 0.04, 0.14],
  accent: [0.12, 0.32, 0.36],
  highlight: [0.95, 0.72, 0.45],
};
