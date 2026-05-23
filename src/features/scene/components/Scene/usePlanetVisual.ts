import { useMemo } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import { assetUrl } from '@/lib/assetUrl';
import type { PlanetAssetId } from '../../types/planet';
import {
  buildVisualPlan,
  cloneAndDress,
  extractBody,
} from '../../services/renderer/planetVisualPlan';
import type { BodyExtraction, PlanetVisualPlan } from '../../services/renderer/planetTypes';
import {
  COLORSHEET_PATH,
  PLANET_PATHS,
  configureColorsheet,
  resolvePlanetLook,
} from '../../services/renderer/planetAssets';
import { planetPoseFor } from '../../services/renderer/planetPose';
import type { PlanetPose } from '../../services/renderer/planetPose';

export type PlanetVisualBundle = {
  readonly plan: PlanetVisualPlan;
  readonly pose: PlanetPose;
  readonly extraction: BodyExtraction;
};

export const usePlanetVisual = (
  assetId: PlanetAssetId,
  phase: number,
): PlanetVisualBundle => {
  const { scene } = useGLTF(assetUrl(PLANET_PATHS[assetId]));
  const colorsheet = useTexture(assetUrl(COLORSHEET_PATH));
  const look = useMemo(() => resolvePlanetLook(assetId), [assetId]);
  const plan = useMemo<PlanetVisualPlan>(() => {
    configureColorsheet(colorsheet);
    return buildVisualPlan(look, cloneAndDress(scene, colorsheet, look), phase);
  }, [scene, colorsheet, look, phase]);
  const extraction = useMemo(() => extractBody(scene), [scene]);
  const pose = useMemo(() => planetPoseFor(extraction), [extraction]);
  return useMemo(() => ({ plan, pose, extraction }), [plan, pose, extraction]);
};
