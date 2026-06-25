/**
 * Grudge Warlords character bridge — fetch from api.grudge-studio.com and
 * resolve grudge6 race GLBs on assets.grudge-studio.com.
 */

import { authHeaders } from './auth';

export const ASSETS_CDN = 'https://assets.grudge-studio.com';
export const API_BASE = '/api';

export interface WarlordsCharacter {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  level: number;
  hp?: number;
  equipment?: Record<string, string | null>;
  model3d?: {
    baseModelId?: string;
    equippedMeshes?: Record<string, string>;
    weaponSlots?: Record<string, string>;
    skinColor?: string;
    armorColor?: string;
    scale?: number;
  };
}

export interface RaceConfig {
  modelId: string;
  prefix: string;
  label: string;
  cdnPath: string;
  scale: number;
  faction: string;
  format: 'fbx' | 'glb';
}

export const RACE_GRUDGE6: Record<string, RaceConfig> = {
  human:     { modelId: 'human',     prefix: 'WK_',  label: 'Human',     cdnPath: '/models/grudge6/metaverse/human.glb',     scale: 1.0,  faction: 'crusade', format: 'glb' },
  barbarian: { modelId: 'barbarian', prefix: 'BRB_', label: 'Barbarian', cdnPath: '/models/grudge6/metaverse/barbarian.glb', scale: 1.1,  faction: 'crusade', format: 'glb' },
  elf:       { modelId: 'elf',       prefix: 'ELF_', label: 'Elf',       cdnPath: '/models/grudge6/metaverse/elf.glb',       scale: 1.0,  faction: 'fabled', format: 'glb' },
  dwarf:     { modelId: 'dwarf',     prefix: 'DWF_', label: 'Dwarf',     cdnPath: '/models/grudge6/metaverse/dwarf.glb',     scale: 0.85, faction: 'crusade', format: 'glb' },
  orc:       { modelId: 'orc',       prefix: 'ORC_', label: 'Orc',       cdnPath: '/models/grudge6/metaverse/orc.glb',       scale: 1.15, faction: 'legion', format: 'glb' },
  undead:    { modelId: 'undead',    prefix: 'UD_',  label: 'Undead',    cdnPath: '/models/grudge6/metaverse/undead.glb',    scale: 1.0,  faction: 'legion', format: 'glb' },
  worge:     { modelId: 'barbarian', prefix: 'BRB_', label: 'Worge',     cdnPath: '/models/grudge6/metaverse/barbarian.glb', scale: 1.1,  faction: 'wild', format: 'glb' },
};

const CLASS_DEFAULT_WEAPONS: Record<string, Record<string, string>> = {
  warrior: { sword: 'A', shield: 'A' },
  ranger:  { bow: '_default', quiver: '_default' },
  mage:    { staff: 'A' },
  worg:    { axe: 'A' },
};

const DEFAULT_ARMOR: Record<string, string> = {
  body: 'A', arms: 'A', legs: 'A', head: 'A',
};

export function resolveRaceModelUrl(raceId: string): string {
  const race = RACE_GRUDGE6[raceId] ?? RACE_GRUDGE6.human;
  return `${ASSETS_CDN}${race.cdnPath}`;
}

export function getRaceConfig(raceId: string): RaceConfig {
  return RACE_GRUDGE6[raceId] ?? RACE_GRUDGE6.human;
}

export function buildModel3d(char: WarlordsCharacter) {
  const raceId = char.raceId || 'human';
  const classId = char.classId || 'warrior';
  const stored = char.model3d ?? {};
  const hasMeshes = stored.equippedMeshes && Object.keys(stored.equippedMeshes).length > 0;
  const hasWeapons = stored.weaponSlots && Object.keys(stored.weaponSlots).length > 0;

  const equippedMeshes = hasMeshes
    ? { ...DEFAULT_ARMOR, ...stored.equippedMeshes }
    : { ...DEFAULT_ARMOR };

  const weaponSlots = hasWeapons
    ? { ...stored.weaponSlots }
    : { ...(CLASS_DEFAULT_WEAPONS[classId] ?? CLASS_DEFAULT_WEAPONS.warrior) };

  const race = getRaceConfig(raceId);
  return {
    equippedMeshes,
    weaponSlots,
    skinColor: stored.skinColor ?? '#ffffff',
    armorColor: stored.armorColor ?? '#ffffff',
    scale: stored.scale ?? race.scale,
    prefix: race.prefix,
  };
}

export async function fetchWarlordsCharacters(): Promise<WarlordsCharacter[]> {
  const res = await fetch(`${API_BASE}/characters`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || contentType.includes('text/html')) {
    throw new Error(`characters ${res.status}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.characters)) return data.characters;
  return [];
}

export async function fetchWarlordsCharacter(id: string): Promise<WarlordsCharacter | null> {
  const res = await fetch(`${API_BASE}/characters/${id}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function createWarlordsCharacter(input: {
  name: string;
  raceId: string;
  classId: string;
}): Promise<WarlordsCharacter> {
  const res = await fetch(`${API_BASE}/characters`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Create failed');
  return data;
}