// Deterministic per-id phase so animation cycles desync across bodies
// sharing the same period.
const idEncoder = new TextEncoder();
const TWO_PI = Math.PI * 2;

export const phaseFromId = (id: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(id)) hash = (hash * 31 + byte) % 1000;
  return (hash / 1000) * TWO_PI;
};
