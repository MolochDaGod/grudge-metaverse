/**
 * Grudge6 metaverse avatar manifest — bundled GLB per race (mesh + Bip001 + all clips).
 */
import { ASSETS_CDN } from './warlordsCharacter';

export const METAVERSE_AVATAR_BASE = `${ASSETS_CDN}/models/grudge6/metaverse`;
export const RACE_GLB_BASE = `${ASSETS_CDN}/models/characters/races`;

/** Bundled avatar GLB (preferred) — idle, walk, run, hit, attack embedded */
export function bundledAvatarUrl(raceId: string): string {
  return `${METAVERSE_AVATAR_BASE}/${raceId}.glb`;
}

/** Fallback race GLB (FBX→GLTF converted, mixamo skeleton) */
export function fallbackRaceGlbUrl(raceId: string): string {
  return `${RACE_GLB_BASE}/${raceId}.glb`;
}

/** External clips when bundled avatar not on CDN yet */
export const FALLBACK_ANIMATION_URLS = {
  idle: `${ASSETS_CDN}/models/animations/sword-shield/sword and shield idle.glb`,
  walk: `${ASSETS_CDN}/models/animations/greatsword/great sword walk.glb`,
  run: `${ASSETS_CDN}/models/animations/sword-shield/sword and shield run.glb`,
} as const;

export const EMBEDDED_CLIP_NAMES = ['idle', 'walk', 'run', 'hit', 'attack'] as const;