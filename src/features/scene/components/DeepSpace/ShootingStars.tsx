import type { JSX } from 'react';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import type { Mesh } from 'three';

const STREAK_COUNT = 4;
const INTERVAL_MIN = 6;
const INTERVAL_MAX = 16;
const DURATION = 1.2;
const SKY_RADIUS = 350;
const STREAK_LENGTH = 60;
const TRAIL_WIDTH = 1.8;
const TRAIL_LENGTH = 5;
const TRAIL_DECAY = 4;
const TRAIL_COLOR = '#ffffff';
const HEAD_RADIUS = 0.35;
const HEAD_COLOR = '#ffffff';
const TWO_PI = Math.PI * 2;

type Vec = [number, number, number];

type Streak = {
  readonly ref: { current: Mesh | null };
  readonly start: Vec;
  readonly end: Vec;
  fireAt: number;
};

const randomUnit = (): Vec => {
  const theta = Math.random() * TWO_PI;
  const z = Math.random() * 2 - 1;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(theta), r * Math.sin(theta), z];
};

const buildPath = (): { start: Vec; end: Vec } => {
  const dir = randomUnit();
  const center: Vec = [dir[0] * SKY_RADIUS, dir[1] * SKY_RADIUS, dir[2] * SKY_RADIUS];
  const up: Vec = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cx = dir[1] * up[2] - dir[2] * up[1];
  const cy = dir[2] * up[0] - dir[0] * up[2];
  const cz = dir[0] * up[1] - dir[1] * up[0];
  const clen = Math.hypot(cx, cy, cz);
  const tx = cx / clen;
  const ty = cy / clen;
  const tz = cz / clen;
  const half = STREAK_LENGTH / 2;
  return {
    start: [center[0] - tx * half, center[1] - ty * half, center[2] - tz * half],
    end:   [center[0] + tx * half, center[1] + ty * half, center[2] + tz * half],
  };
};

const randomInterval = (): number =>
  INTERVAL_MIN + Math.random() * (INTERVAL_MAX - INTERVAL_MIN);

const buildStreak = (initialFireAt: number): Streak => {
  const { start, end } = buildPath();
  return { ref: { current: null }, start, end, fireAt: initialFireAt };
};

const attenuation = (x: number): number => x * x;

const advanceStreak = (streak: Streak, t: number): void => {
  const mesh = streak.ref.current;
  if (mesh === null) return;
  const since = t - streak.fireAt;
  if (since < 0) {
    mesh.visible = false;
    return;
  }
  const localT = since / DURATION;
  if (localT >= 1) {
    const { start, end } = buildPath();
    streak.start[0] = start[0]; streak.start[1] = start[1]; streak.start[2] = start[2];
    streak.end[0]   = end[0];   streak.end[1]   = end[1];   streak.end[2]   = end[2];
    streak.fireAt = t + randomInterval();
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.position.set(
    streak.start[0] + (streak.end[0] - streak.start[0]) * localT,
    streak.start[1] + (streak.end[1] - streak.start[1]) * localT,
    streak.start[2] + (streak.end[2] - streak.start[2]) * localT,
  );
};

export const ShootingStars = (): JSX.Element => {
  const streaks = useMemo<ReadonlyArray<Streak>>(
    () =>
      Array.from({ length: STREAK_COUNT }, () =>
        buildStreak(Math.random() * INTERVAL_MAX),
      ),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const streak of streaks) advanceStreak(streak, t);
  });

  return (
    <>
      {streaks.map((streak, i) => (
        <Trail
          key={i}
          width={TRAIL_WIDTH}
          length={TRAIL_LENGTH}
          color={TRAIL_COLOR}
          decay={TRAIL_DECAY}
          attenuation={attenuation}
        >
          <mesh
            ref={(node) => {
              streak.ref.current = node;
            }}
            visible={false}
          >
            <sphereGeometry args={[HEAD_RADIUS, 8, 8]} />
            <meshBasicMaterial color={HEAD_COLOR} />
          </mesh>
        </Trail>
      ))}
    </>
  );
};
