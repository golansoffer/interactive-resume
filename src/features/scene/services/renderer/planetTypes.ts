import type { IUniform, Mesh, MeshStandardMaterial, Object3D } from 'three';

export type IdleBreath = {
  readonly amplitude: number;
  readonly frequencyHz: number;
};

export type RimScalePulse = {
  readonly amplitude: number;
  readonly frequencyHz: number;
};

export type RimSpec = {
  readonly tint: readonly [number, number, number];
  readonly power: number;
  readonly opacity: number;
  readonly scale: number;
  readonly breath: IdleBreath;
  readonly scalePulse: RimScalePulse;
};

export type PulseSpec = {
  readonly amplitude: number;
  readonly frequencyHz: number;
  // Emissive intensity floor — the trough of the pulse. Per-planet because
  // active-capable planets sit visibly brighter at rest than body-only
  // planets; folding both into one type kills the prior module-level
  // PULSE_FLOOR / PLAIN_EMISSIVE_INTENSITY split.
  readonly floor: number;
  readonly emissiveTint: readonly [number, number, number];
};

// Every planet has a body pulse — baseline aliveness. Some are also
// "active-capable" and additionally carry a rim spec (the fresnel
// atmosphere that fades in on proximity). The discriminator encodes rim
// presence; there is no optional rim field.
export type PlanetLook =
  | { readonly kind: 'body_only'; readonly pulse: PulseSpec }
  | { readonly kind: 'body_and_rim'; readonly pulse: PulseSpec; readonly rim: RimSpec };

export type PoleAxis = 'x' | 'y' | 'z';

// The planet's visual pole expressed as a unit vector in the mesh's local
// space. For ringed bodies it's the ring's plane normal; for non-ringed
// bodies it's the axis the colour bands wrap around. The pose builds a
// quaternion that rotates this exact vector onto world-up, so the rendered
// pole lands precisely vertical instead of leaning by the residual that a
// cardinal-axis snap would leave (Jupiter_b's band normal is `(0.34, 0.77,
// 0.54)` — only 77% of `+y`, off by 24° after a snap).
export type PoleDirection = readonly [number, number, number];

export type BodyExtraction =
  | { readonly kind: 'no_body' }
  | {
      readonly kind: 'body';
      readonly mesh: Mesh;
      readonly radius: number;
      readonly poleDirection: PoleDirection;
    }
  | {
      readonly kind: 'ringed_body';
      readonly mesh: Mesh;
      readonly radius: number;
      readonly poleDirection: PoleDirection;
    };

export type AtmospherePlan = {
  readonly opacityUniform: IUniform<number>;
  readonly timeUniform: IUniform<number>;
  readonly baseOpacity: number;
  readonly breath: IdleBreath;
  readonly rimMesh: Mesh;
  readonly baseScale: number;
  readonly scalePulse: RimScalePulse;
};

// `no_body` is the degenerate fallback when extractBody could not pick a
// body mesh out of the GLTF (no spherical candidate). In that case
// nothing animates, no outline, no atmosphere — just the raw cloned
// scene. For every real planet asset shipped here the plan is body_only
// or body_and_rim. The outline mesh is attached to the body during
// buildVisualPlan as a side effect and never referenced again; it is
// intentionally not stored in the plan.
export type PlanetVisualPlan =
  | { readonly kind: 'no_body'; readonly scene: Object3D }
  | {
      readonly kind: 'body_only';
      readonly scene: Object3D;
      readonly pulse: PulseSpec;
      readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
    }
  | {
      readonly kind: 'body_and_rim';
      readonly scene: Object3D;
      readonly pulse: PulseSpec;
      readonly atmosphere: AtmospherePlan;
      readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
    };

export type ClonedScene = {
  readonly scene: Object3D;
  readonly extraction: BodyExtraction;
  readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
};
