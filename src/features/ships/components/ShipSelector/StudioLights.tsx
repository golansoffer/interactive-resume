import type { JSX } from 'react';

// Studio lighting — 3-point + hemisphere rig. Key (warm), fill (cool),
// rim (cyan accent matching the engine wake), ground bounce. Hero
// surfaces amp the key for theatrical depth; thumbnails share the same
// rig at base intensity so they read consistently in the strip.
const KEY_COLOR = '#fff5e8';
const FILL_COLOR = '#a8d4ff';
const RIM_COLOR = '#5fd6ff';
const HEMI_TOP = '#7aa8ff';
const HEMI_BOTTOM = '#08111e';

export const KEY_INTENSITY_THUMB = 2.2;
export const KEY_INTENSITY_HERO = 4.4;
const FILL_INTENSITY = 1.0;
const RIM_INTENSITY = 1.8;
const AMBIENT_INTENSITY = 0.6;
const HEMI_INTENSITY = 0.3;

type StudioLightsProps = {
  readonly keyIntensity: number;
};

export const StudioLights = (props: StudioLightsProps): JSX.Element => (
  <>
    <ambientLight intensity={AMBIENT_INTENSITY} />
    <directionalLight position={[6, 8, 5]} intensity={props.keyIntensity} color={KEY_COLOR} />
    <directionalLight position={[-5, 4, 3]} intensity={FILL_INTENSITY} color={FILL_COLOR} />
    <directionalLight position={[0, 3, -6]} intensity={RIM_INTENSITY} color={RIM_COLOR} />
    <hemisphereLight args={[HEMI_TOP, HEMI_BOTTOM, HEMI_INTENSITY]} />
  </>
);
