import { CanvasTexture } from 'three';

const HALO_SIZE = 128;

type GradientStyle = 'soft' | 'sharp';

type GradientStop = readonly [number, number];

const SOFT_GRADIENT_STOPS: ReadonlyArray<GradientStop> = [
  [0.0, 1.0],
  [0.16, 0.78],
  [0.4, 0.32],
  [0.7, 0.08],
  [1.0, 0.0],
];

const SHARP_GRADIENT_STOPS: ReadonlyArray<GradientStop> = [
  [0.0, 1.0],
  [0.06, 0.95],
  [0.18, 0.55],
  [0.42, 0.12],
  [0.78, 0.02],
  [1.0, 0.0],
];

const stopsFor = (style: GradientStyle): ReadonlyArray<GradientStop> =>
  style === 'soft' ? SOFT_GRADIENT_STOPS : SHARP_GRADIENT_STOPS;

const paintRadialGradient = (
  ctx: CanvasRenderingContext2D,
  size: number,
  style: GradientStyle,
): void => {
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  for (const [offset, alpha] of stopsFor(style)) {
    gradient.addColorStop(offset, `rgba(255,255,255,${alpha})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
};

const buildHaloTexture = (style: GradientStyle): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = HALO_SIZE;
  canvas.height = HALO_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx !== null) paintRadialGradient(ctx, HALO_SIZE, style);
  return new CanvasTexture(canvas);
};

type HaloCell =
  | { readonly kind: 'uninit' }
  | { readonly kind: 'ready'; readonly texture: CanvasTexture };

let softCell: HaloCell = { kind: 'uninit' };
let sharpCell: HaloCell = { kind: 'uninit' };

const readOrBuild = (style: GradientStyle, cell: HaloCell): CanvasTexture => {
  if (cell.kind === 'ready') return cell.texture;
  return buildHaloTexture(style);
};

export type CelestialFlightHaloRequest = { readonly style: GradientStyle };

export const getCelestialFlightHaloTexture = (
  request: CelestialFlightHaloRequest,
): CanvasTexture => {
  if (request.style === 'soft') {
    const texture = readOrBuild('soft', softCell);
    softCell = { kind: 'ready', texture };
    return texture;
  }
  const texture = readOrBuild('sharp', sharpCell);
  sharpCell = { kind: 'ready', texture };
  return texture;
};
