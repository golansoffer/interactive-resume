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
  readonly emissiveTint: readonly [number, number, number];
};

// PlanetLook is the per-asset configured effect bundle. Every "looking"
// planet carries both a body pulse (baseline aliveness — always on) and a
// rim (gated on activation by an external 0..1 factor at animation time).
// Unconfigured asset ids resolve to 'plain' (no effects).
export type PlanetLook =
  | { readonly kind: 'plain' }
  | { readonly kind: 'effects'; readonly pulse: PulseSpec; readonly rim: RimSpec };

export type PoleAxis = 'x' | 'y' | 'z';

export type BodyExtraction =
  | { readonly kind: 'no_body' }
  | {
      readonly kind: 'body';
      readonly mesh: Mesh;
      readonly radius: number;
      readonly poleAxis: PoleAxis;
    }
  | {
      readonly kind: 'ringed_body';
      readonly mesh: Mesh;
      readonly radius: number;
      readonly poleAxis: PoleAxis;
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

export type PlanetVisualPlan =
  | { readonly kind: 'plain'; readonly scene: Object3D }
  | {
      readonly kind: 'effects';
      readonly scene: Object3D;
      readonly atmosphere: AtmospherePlan;
      readonly pulse: PulseSpec;
      readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
    };

export type ClonedScene = {
  readonly scene: Object3D;
  readonly extraction: BodyExtraction;
  readonly standardMaterials: ReadonlyArray<MeshStandardMaterial>;
};
