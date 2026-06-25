/**
 * Bip001 animation clips for grudge6 avatars — retargeted Paragon/Rokoko + BRB idle.
 */
import { ASSETS_CDN } from './warlordsCharacter';

const BASE = `${ASSETS_CDN}/models/animations`;
const BRB = `${BASE}/grudge6_brb/base`;
const RETARGET = `${BASE}/retargeted/bip001`;

export const GRUDGE6_ANIMATION_URLS = {
  idle: `${BRB}/Idle.glb`,
  walk: `${RETARGET}/paragon_walk.glb`,
  run: `${RETARGET}/paragon_run.glb`,
  hit: `${RETARGET}/paragon_hit.glb`,
  attack: `${RETARGET}/rokoko_boxing.glb`,
} as const;

export type LocomotionState = 'idle' | 'walk' | 'run';