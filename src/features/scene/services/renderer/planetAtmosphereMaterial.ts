import { AdditiveBlending, FrontSide, ShaderMaterial, Vector3 } from 'three';

export type PlanetAtmosphereParams = {
  readonly tint: readonly [number, number, number];
  readonly power: number;
  readonly opacity: number;
  readonly phase: number;
};

const VERTEX_SHADER = `
varying vec3 vNormalView;
varying vec3 vPositionView;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vPositionView = viewPosition.xyz;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewPosition;
}
`;

// Fragment combines (1) view-angle fresnel for the silhouette band, with
// (2) a multi-band spatial-temporal shimmer using the angular coordinate of
// the view-space normal around the rim. The dominant motion is a single-band
// aurora-style sweep (one bright crest revolving the rim every ~7s) —
// this is the wave the eye reads as "flow". Medium and fine bands counter-
// rotate against it for organic, non-repeating variation. uPhase desyncs
// every planet's pattern so the ring of atmospheres doesn't move in unison.
// The shimmer multiplies fresnel, so it only shows where the rim already
// lives — no contribution at the planet center where facing≈1.
const FRAGMENT_SHADER = `
uniform vec3 uTint;
uniform float uPower;
uniform float uOpacity;
uniform float uTime;
uniform float uPhase;

varying vec3 vNormalView;
varying vec3 vPositionView;

void main() {
  vec3 normal = normalize(vNormalView);
  vec3 viewDir = normalize(-vPositionView);
  float facing = max(dot(normal, viewDir), 0.0);
  float baseFresnel = pow(1.0 - facing, uPower);

  float angle = atan(normal.y, normal.x);
  float shimmer =
      sin(angle - uTime * 0.85 + uPhase) * 0.32
    + sin(angle * 3.0 + uTime * 2.00 + uPhase * 1.7) * 0.22
    + sin(angle * 7.0 - uTime * 1.10 + uPhase * 0.4) * 0.10;

  float modulated = baseFresnel * (1.0 + shimmer);
  float alpha = modulated * uOpacity;
  gl_FragColor = vec4(uTint * uOpacity * modulated, alpha);
}
`;

export const createPlanetAtmosphereMaterial = (
  params: PlanetAtmosphereParams,
): ShaderMaterial => {
  const [r, g, b] = params.tint;
  return new ShaderMaterial({
    uniforms: {
      uTint: { value: new Vector3(r, g, b) },
      uPower: { value: params.power },
      uOpacity: { value: params.opacity },
      uTime: { value: 0 },
      uPhase: { value: params.phase },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
  });
};
