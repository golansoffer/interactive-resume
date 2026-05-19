import type { JSX } from 'react';
import { useMemo, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import type { Group } from 'three';
import { starParallaxOffset } from '../../services/renderer/starParallaxOffset';

type StarShell = {
  readonly radius: number;
  readonly depth: number;
  readonly count: number;
  readonly factor: number;
  readonly saturation: number;
  readonly speed: number;
  readonly parallax: number;
};

const SHELLS: ReadonlyArray<StarShell> = [
  { radius: 460, depth: 50, count: 3000, factor: 1, saturation: 0, speed: 0.3, parallax: 0.0 },
  { radius: 320, depth: 80, count: 1500, factor: 2, saturation: 0.4, speed: 0.5, parallax: 0.04 },
  { radius: 180, depth: 100, count: 300, factor: 4, saturation: 0.8, speed: 0.8, parallax: 0.1 },
];

type ShellBinding = {
  readonly shell: StarShell;
  readonly ref: RefObject<Group | null>;
};

type StarParallaxProps = {
  readonly starDensity: number;
  readonly motionResponse: number;
};

export const StarParallax = (props: StarParallaxProps): JSX.Element => {
  const camera = useThree((s) => s.camera);
  const bindings = useMemo<ReadonlyArray<ShellBinding>>(
    () => SHELLS.map((shell) => ({ shell, ref: { current: null } })),
    [],
  );

  useFrame(() => {
    for (const binding of bindings) {
      const g = binding.ref.current;
      if (g === null) continue;
      const factor = binding.shell.parallax * props.motionResponse;
      const offset = starParallaxOffset(camera.position, factor);
      g.position.set(offset.x, offset.y, offset.z);
    }
  });

  return (
    <>
      {bindings.map((binding, i) => (
        <group
          key={i}
          ref={(node) => {
            binding.ref.current = node;
          }}
        >
          <Stars
            radius={binding.shell.radius}
            depth={binding.shell.depth}
            count={Math.round(binding.shell.count * props.starDensity)}
            factor={binding.shell.factor}
            saturation={binding.shell.saturation}
            fade
            speed={binding.shell.speed}
          />
        </group>
      ))}
    </>
  );
};
