/**
 * Grudge6 metaverse avatar manifest — bundled GLB per race (mesh + Bip001 + all clips).
 */
import { ASSETS_CDN } from './warlordsCharacter';

/** Same-origin baked GLBs (metaverse host + local dev middleware). */
export const METAVERSE_AVATAR_LOCAL = '/models/grudge6/metaverse';
/** CDN baked GLBs. */
export const METAVERSE_AVATAR_CDN = `${ASSETS_CDN}/models/grudge6/metaverse`;
export const RACE_GLB_BASE = `${ASSETS_CDN}/models/characters/races`;

export interface AvatarUrlCandidate {
  url: string;
  label: string;
}

/** Try same-origin first, then CDN — avoids silent CDN/CORS failures on deploy. */
export function avatarGlbCandidates(raceId: string): AvatarUrlCandidate[] {
  const file = `${raceId}.glb`;
  return [
    { url: `${METAVERSE_AVATAR_LOCAL}/${file}`, label: 'local-metaverse' },
    { url: `${METAVERSE_AVATAR_CDN}/${file}`, label: 'cdn-metaverse' },
    { url: `${RACE_GLB_BASE}/${raceId}.glb`, label: 'race-glb-fallback' },
  ];
}

/** @deprecated use avatarGlbCandidates */
export function bundledAvatarUrl(raceId: string): string {
  return `${METAVERSE_AVATAR_CDN}/${raceId}.glb`;
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