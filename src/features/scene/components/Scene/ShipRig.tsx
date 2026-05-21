import type { JSX } from 'react';

// Ship-local studio rig — additive on top of the scene's global ambient +
// key light, so the craft carries its own warm/cool/rim signature in
// ship-world axes regardless of where it flies relative to the sun.
const RIG_KEY_COLOR = '#fff5e8';
const RIG_FILL_COLOR = '#a8d4ff';
const RIG_RIM_COLOR = '#5fd6ff';
const RIG_HEMI_TOP = '#7aa8ff';
const RIG_HEMI_BOTTOM = '#08111e';

const RIG_KEY_INTENSITY = 2.4;
const RIG_FILL_INTENSITY = 0.7;
const RIG_RIM_INTENSITY = 1.4;
const RIG_HEMI_INTENSITY = 0.35;

export const ShipRig = (): JSX.Element => (
  <>
    <directionalLight position={[6, 8, 5]} intensity={RIG_KEY_INTENSITY} color={RIG_KEY_COLOR} />
    <directionalLight position={[-5, 4, 3]} intensity={RIG_FILL_INTENSITY} color={RIG_FILL_COLOR} />
    <directionalLight position={[0, 3, -6]} intensity={RIG_RIM_INTENSITY} color={RIG_RIM_COLOR} />
    <hemisphereLight args={[RIG_HEMI_TOP, RIG_HEMI_BOTTOM, RIG_HEMI_INTENSITY]} />
  </>
);
