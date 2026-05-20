import type { Mesh } from 'three';

// Band-normal pole detection. The planet GLBs in this asset set are textured
// off a small palette colorsheet: each face's UV.v picks a row, so faces
// sharing a V form a single colored "band" on the model. PCA on each band's
// face centroids yields the band's plane normal; aggregating those normals
// (face-count weighted, sign-aligned) gives the model-space axis the bands
// wrap around — i.e. the planet's visual pole. This signal is independent
// of mesh tessellation and bounding-box dims, both of which become unreliable
// on perfectly spherical meshes (e.g. Jupiter_b at sphericity ~0.99999, all
// three bbox dims equal to 7 decimals).

export type BandNormalResult =
  | {
      readonly kind: 'detected';
      readonly direction: readonly [number, number, number];
    }
  | { readonly kind: 'unavailable' };

// Smallest-eigenvalue eigenvector of a 3×3 symmetric matrix via Jacobi
// rotations on the three off-diagonal pairs. The matrix is a covariance, so
// the smallest eigenvalue's vector is the axis of least variance — the
// normal of the best-fit plane through the points that produced it.
const rotate01 = (
  a00: number, a01: number, a02: number, a11: number, a12: number, a22: number,
  v: Mat3Cols,
): Pair => {
  if (Math.abs(a01) < 1e-16) return { a: [a00, a01, a02, a11, a12, a22], v };
  const theta = (a11 - a00) / (2 * a01);
  const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
  const c = 1 / Math.sqrt(1 + t * t);
  const s = t * c;
  const a00n = c * c * a00 - 2 * s * c * a01 + s * s * a11;
  const a11n = s * s * a00 + 2 * s * c * a01 + c * c * a11;
  const a02n = c * a02 - s * a12;
  const a12n = s * a02 + c * a12;
  const v0xn = c * v.v0x - s * v.v1x;
  const v1xn = s * v.v0x + c * v.v1x;
  const v0yn = c * v.v0y - s * v.v1y;
  const v1yn = s * v.v0y + c * v.v1y;
  const v0zn = c * v.v0z - s * v.v1z;
  const v1zn = s * v.v0z + c * v.v1z;
  return {
    a: [a00n, 0, a02n, a11n, a12n, a22],
    v: { v0x: v0xn, v0y: v0yn, v0z: v0zn, v1x: v1xn, v1y: v1yn, v1z: v1zn, v2x: v.v2x, v2y: v.v2y, v2z: v.v2z },
  };
};

const rotate02 = (
  a00: number, a01: number, a02: number, a11: number, a12: number, a22: number,
  v: Mat3Cols,
): Pair => {
  if (Math.abs(a02) < 1e-16) return { a: [a00, a01, a02, a11, a12, a22], v };
  const theta = (a22 - a00) / (2 * a02);
  const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
  const c = 1 / Math.sqrt(1 + t * t);
  const s = t * c;
  const a00n = c * c * a00 - 2 * s * c * a02 + s * s * a22;
  const a22n = s * s * a00 + 2 * s * c * a02 + c * c * a22;
  const a01n = c * a01 - s * a12;
  const a12n = s * a01 + c * a12;
  const v0xn = c * v.v0x - s * v.v2x;
  const v2xn = s * v.v0x + c * v.v2x;
  const v0yn = c * v.v0y - s * v.v2y;
  const v2yn = s * v.v0y + c * v.v2y;
  const v0zn = c * v.v0z - s * v.v2z;
  const v2zn = s * v.v0z + c * v.v2z;
  return {
    a: [a00n, a01n, 0, a11, a12n, a22n],
    v: { v0x: v0xn, v0y: v0yn, v0z: v0zn, v1x: v.v1x, v1y: v.v1y, v1z: v.v1z, v2x: v2xn, v2y: v2yn, v2z: v2zn },
  };
};

const rotate12 = (
  a00: number, a01: number, a02: number, a11: number, a12: number, a22: number,
  v: Mat3Cols,
): Pair => {
  if (Math.abs(a12) < 1e-16) return { a: [a00, a01, a02, a11, a12, a22], v };
  const theta = (a22 - a11) / (2 * a12);
  const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
  const c = 1 / Math.sqrt(1 + t * t);
  const s = t * c;
  const a11n = c * c * a11 - 2 * s * c * a12 + s * s * a22;
  const a22n = s * s * a11 + 2 * s * c * a12 + c * c * a22;
  const a01n = c * a01 - s * a02;
  const a02n = s * a01 + c * a02;
  const v1xn = c * v.v1x - s * v.v2x;
  const v2xn = s * v.v1x + c * v.v2x;
  const v1yn = c * v.v1y - s * v.v2y;
  const v2yn = s * v.v1y + c * v.v2y;
  const v1zn = c * v.v1z - s * v.v2z;
  const v2zn = s * v.v1z + c * v.v2z;
  return {
    a: [a00, a01n, a02n, a11n, 0, a22n],
    v: { v0x: v.v0x, v0y: v.v0y, v0z: v.v0z, v1x: v1xn, v1y: v1yn, v1z: v1zn, v2x: v2xn, v2y: v2yn, v2z: v2zn },
  };
};

type Mat3Cols = {
  readonly v0x: number; readonly v0y: number; readonly v0z: number;
  readonly v1x: number; readonly v1y: number; readonly v1z: number;
  readonly v2x: number; readonly v2y: number; readonly v2z: number;
};
type ASymHalf = readonly [number, number, number, number, number, number];
type Pair = { readonly a: ASymHalf; readonly v: Mat3Cols };

const IDENTITY_COLS: Mat3Cols = {
  v0x: 1, v0y: 0, v0z: 0,
  v1x: 0, v1y: 1, v1z: 0,
  v2x: 0, v2y: 0, v2z: 1,
};

const smallestEigenvector3x3 = (
  m00: number, m01: number, m02: number, m11: number, m12: number, m22: number,
): readonly [number, number, number] => {
  let pair: Pair = { a: [m00, m01, m02, m11, m12, m22], v: IDENTITY_COLS };
  for (let sweep = 0; sweep < 60; sweep++) {
    const [a00, a01, a02, a11, a12, a22] = pair.a;
    if (Math.abs(a01) + Math.abs(a02) + Math.abs(a12) < 1e-14) break;
    pair = rotate01(a00, a01, a02, a11, a12, a22, pair.v);
    const [b00, b01, b02, b11, b12, b22] = pair.a;
    pair = rotate02(b00, b01, b02, b11, b12, b22, pair.v);
    const [c00, c01, c02, c11, c12, c22] = pair.a;
    pair = rotate12(c00, c01, c02, c11, c12, c22, pair.v);
  }
  const [a00, , , a11, , a22] = pair.a;
  const { v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z } = pair.v;
  if (a00 <= a11 && a00 <= a22) return [v0x, v1x, v2x];
  if (a11 <= a22) return [v0y, v1y, v2y];
  return [v0z, v1z, v2z];
};

type FaceCentroid = readonly [number, number, number];
type Bucket = { readonly points: Array<FaceCentroid> };

const collectFaceBuckets = (mesh: Mesh): Map<number, Bucket> | null => {
  const g = mesh.geometry;
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  if (pos === undefined || uv === undefined) return null;
  const index = g.index;
  const faceCount = index === null ? pos.count / 3 : index.count / 3;
  const buckets = new Map<number, Bucket>();
  for (let f = 0; f < faceCount; f++) {
    const i0 = index === null ? f * 3 : index.getX(f * 3);
    const i1 = index === null ? f * 3 + 1 : index.getX(f * 3 + 1);
    const i2 = index === null ? f * 3 + 2 : index.getX(f * 3 + 2);
    const cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
    const cy = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
    const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
    const v = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3;
    // 0.005-wide V buckets: matches the colorsheet palette's discrete row
    // spacing (96px tall texture → ~0.0104 between rows; 0.005 buckets group
    // faces sharing a row tightly without merging neighbours).
    const key = Math.round(v * 200);
    const bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, { points: [[cx, cy, cz]] });
    else bucket.points.push([cx, cy, cz]);
  }
  return buckets;
};

type Covariance = {
  readonly cxx: number; readonly cxy: number; readonly cxz: number;
  readonly cyy: number; readonly cyz: number; readonly czz: number;
};

const covarianceOf = (pts: ReadonlyArray<FaceCentroid>): Covariance => {
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (const [px, py, pz] of pts) { mx += px; my += py; mz += pz; }
  mx /= pts.length; my /= pts.length; mz /= pts.length;
  let cxx = 0; let cxy = 0; let cxz = 0;
  let cyy = 0; let cyz = 0; let czz = 0;
  for (const [px, py, pz] of pts) {
    const x = px - mx; const y = py - my; const z = pz - mz;
    cxx += x * x; cxy += x * y; cxz += x * z;
    cyy += y * y; cyz += y * z; czz += z * z;
  }
  return { cxx, cxy, cxz, cyy, cyz, czz };
};

export const computeBandNormal = (mesh: Mesh): BandNormalResult => {
  const buckets = collectFaceBuckets(mesh);
  if (buckets === null) return { kind: 'unavailable' };
  let aggX = 0; let aggY = 0; let aggZ = 0; let aggW = 0;
  for (const bucket of buckets.values()) {
    const pts = bucket.points;
    // Bands with too few faces are noise (palette-corner pixels picked by
    // stray faces). 8 is the minimum face count where PCA gives a stable
    // principal axis on a ring-shaped band.
    if (pts.length < 8) continue;
    const c = covarianceOf(pts);
    const [nx, ny, nz] = smallestEigenvector3x3(c.cxx, c.cxy, c.cxz, c.cyy, c.cyz, c.czz);
    // Sign-align by largest component so opposing band normals don't cancel
    // when aggregated across buckets.
    const ax = Math.abs(nx); const ay = Math.abs(ny); const az = Math.abs(nz);
    const domVal = ax >= ay && ax >= az ? nx : ay >= az ? ny : nz;
    const sign = domVal >= 0 ? 1 : -1;
    aggX += sign * nx * pts.length;
    aggY += sign * ny * pts.length;
    aggZ += sign * nz * pts.length;
    aggW += pts.length;
  }
  if (aggW === 0) return { kind: 'unavailable' };
  const len = Math.sqrt(aggX * aggX + aggY * aggY + aggZ * aggZ);
  if (len === 0) return { kind: 'unavailable' };
  return { kind: 'detected', direction: [aggX / len, aggY / len, aggZ / len] };
};
