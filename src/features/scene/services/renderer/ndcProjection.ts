import { Vector3, type Camera } from 'three';

const scratch = new Vector3();

export const projectToNdc = (
  point: readonly [number, number, number],
  camera: Camera,
): readonly [number, number] => {
  scratch.set(point[0], point[1], point[2]);
  scratch.project(camera);
  return [scratch.x, scratch.y];
};

export const isInsideNdc = (ndc: readonly [number, number]): boolean =>
  ndc[0] >= -1 && ndc[0] <= 1 && ndc[1] >= -1 && ndc[1] <= 1;

const EDGE_PADDING = 0.92;

export const clampToEdge = (
  ndcX: number,
  ndcY: number,
): { readonly edgeX: number; readonly edgeY: number } => {
  const magnitude = Math.max(Math.abs(ndcX), Math.abs(ndcY));
  if (magnitude === 0) return { edgeX: 0, edgeY: 0 };
  const scale = EDGE_PADDING / magnitude;
  return { edgeX: ndcX * scale, edgeY: ndcY * scale };
};
