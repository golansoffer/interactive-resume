import type { CSSProperties, JSX } from 'react';
import type { PlanetAssetId } from '../../../scene/types/planet';

type PipPlanetProps = {
  readonly assetId: PlanetAssetId;
};

// CSS-rendered planet representation for the 16px pip column. The full GLTF
// pipeline is too heavy for 5 always-on Canvas instances and provides no
// visible detail at this size — what reads is silhouette and color. We map
// each planet base name to a radial gradient that matches the in-world
// rendering vibe.
const planetKeyOf = (assetId: PlanetAssetId): string => {
  const [base] = assetId.split('_');
  return base ?? '';
};

const PLANET_GRADIENT: Readonly<Record<string, string>> = {
  saturn: 'radial-gradient(circle at 35% 30%, #f5d99a 0%, #c9a86a 50%, #8b6f3d 100%)',
  jupiter: 'radial-gradient(circle at 35% 30%, #e8b88a 0%, #b87a5a 35%, #6f4528 80%, #4a2e1a 100%)',
  mars: 'radial-gradient(circle at 35% 30%, #d97a4a 0%, #a04525 45%, #5a2412 100%)',
  earth: 'radial-gradient(circle at 35% 30%, #6fb5d6 0%, #2d7090 45%, #133c5a 100%)',
  venus: 'radial-gradient(circle at 35% 30%, #f3d97a 0%, #c79c45 50%, #7a5c1f 100%)',
  mercury: 'radial-gradient(circle at 35% 30%, #c0bcb5 0%, #8a857d 50%, #4a463f 100%)',
  neptune: 'radial-gradient(circle at 35% 30%, #6fa3d6 0%, #3669a8 45%, #15315e 100%)',
  uranus: 'radial-gradient(circle at 35% 30%, #b8e6e0 0%, #5fa39a 45%, #2c5854 100%)',
  pluto: 'radial-gradient(circle at 35% 30%, #d6c4a8 0%, #8a7860 45%, #44382a 100%)',
  moon: 'radial-gradient(circle at 35% 30%, #d4d2cc 0%, #8d8a82 50%, #4a463f 100%)',
  sun: 'radial-gradient(circle at 50% 50%, #ffe7a8 0%, #f7a73a 50%, #c45a14 100%)',
};

const FALLBACK_GRADIENT =
  'radial-gradient(circle at 35% 30%, #b0aea8 0%, #7a7770 50%, #3e3b35 100%)';

const gradientFor = (assetId: PlanetAssetId): string => {
  const key = planetKeyOf(assetId);
  const found = PLANET_GRADIENT[key];
  return found ?? FALLBACK_GRADIENT;
};

// Specular highlight overlay — matches the look R3F's directional key light
// gives the live headline planet.
const SPECULAR_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35) 0%, transparent 38%)',
  pointerEvents: 'none',
};

export const PipPlanet = (props: PipPlanetProps): JSX.Element => {
  const isSaturn = planetKeyOf(props.assetId) === 'saturn';
  return (
    <div
      data-pip-planet={props.assetId}
      className="relative h-full w-full rounded-full"
      style={{ background: gradientFor(props.assetId) }}
    >
      <span aria-hidden="true" style={SPECULAR_STYLE} />
      {isSaturn ? <SaturnRing /> : null}
    </div>
  );
};

const SATURN_RING_STYLE: CSSProperties = {
  position: 'absolute',
  inset: '-2px -5px',
  border: '1px solid rgba(220, 200, 160, 0.55)',
  borderRadius: '50%',
  transform: 'rotate(-22deg) scaleY(0.28)',
  pointerEvents: 'none',
  zIndex: -1,
};

const SaturnRing = (): JSX.Element => (
  <span aria-hidden="true" data-saturn-ring style={SATURN_RING_STYLE} />
);
