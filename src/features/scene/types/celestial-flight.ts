export type Vec3 = readonly [number, number, number];
export type Rgb = readonly [number, number, number];

export type HaloStyle = 'soft' | 'sharp' | 'none';

export type FlightKind =
  | {
      readonly kind: 'comet_hero';
      readonly trailWidth: number;
      readonly trailLength: number;
      readonly trailBlending: 'additive';
      readonly trailOpacity: number;
      readonly trailAttenuationExponent: number;
      readonly trailDecay: number;
      readonly trailStride: number;
      readonly trailToneMapped: false;
      readonly headSize: number;
      readonly haloStyle: 'soft';
      readonly haloSizeMultiplier: number;
      readonly ease: 'smooth_s';
      readonly tailCoastSeconds: number;
    }
  | {
      readonly kind: 'comet_distant';
      readonly trailWidth: number;
      readonly trailLength: number;
      readonly trailBlending: 'additive';
      readonly trailOpacity: number;
      readonly trailAttenuationExponent: number;
      readonly trailDecay: number;
      readonly trailStride: number;
      readonly trailToneMapped: false;
      readonly headSize: number;
      readonly haloStyle: 'soft';
      readonly haloSizeMultiplier: number;
      readonly ease: 'linear';
      readonly tailCoastSeconds: number;
    }
  | {
      readonly kind: 'asteroid_drift';
      readonly trailWidth: number;
      readonly trailLength: number;
      readonly trailBlending: 'normal';
      readonly trailOpacity: number;
      readonly trailAttenuationExponent: number;
      readonly trailDecay: number;
      readonly trailStride: number;
      readonly trailToneMapped: true;
      readonly headSize: number;
      readonly haloStyle: 'none';
      readonly ease: 'linear';
      readonly tailCoastSeconds: number;
    };

export type ArchetypeKind = FlightKind['kind'];

export type LayerKind = 'background' | 'midground';

export type DistributionEntry = {
  readonly archetype: ArchetypeKind;
  readonly weight: number;
};

export type DepthLayer = {
  readonly kind: LayerKind;
  readonly parallax: number;
  readonly capacity: number;
  readonly radius: number;
  readonly bulgeMin: number;
  readonly bulgeMax: number;
  readonly arcAngleMinRad: number;
  readonly arcAngleMaxRad: number;
  readonly durationMin: number;
  readonly durationMax: number;
  readonly distribution: ReadonlyArray<DistributionEntry>;
  readonly palette: ReadonlyArray<Rgb>;
};

export type Flight = {
  readonly id: number;
  readonly kind: FlightKind;
  readonly layer: LayerKind;
  readonly p0: Vec3;
  readonly p1: Vec3;
  readonly p2: Vec3;
  readonly duration: number;
  readonly startedAt: number;
  readonly color: Rgb;
  readonly trailWidthScale: number;
  readonly trailLengthScale: number;
};

export type FlightSample =
  | {
      readonly kind: 'traversing';
      readonly position: Vec3;
      readonly tangent: Vec3;
      readonly age01: number;
    }
  | {
      readonly kind: 'coasting';
      readonly position: Vec3;
      readonly tangent: Vec3;
      readonly coastProgress01: number;
    }
  | {
      readonly kind: 'completed';
      readonly endedAt: number;
    };

export type FlightSchedule = {
  readonly kind: 'flight_schedule';
  readonly seed: number;
  readonly rngState: number;
  readonly nextId: number;
  readonly layers: ReadonlyArray<DepthLayer>;
  readonly flights: ReadonlyArray<Flight>;
};

export type Rng = { readonly next: () => number };

export type ArchetypeTable = {
  readonly comet_hero: Extract<FlightKind, { kind: 'comet_hero' }>;
  readonly comet_distant: Extract<FlightKind, { kind: 'comet_distant' }>;
  readonly asteroid_drift: Extract<FlightKind, { kind: 'asteroid_drift' }>;
};
