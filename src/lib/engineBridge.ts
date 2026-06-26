/**
 * Bridge metaverse → GrudgeBuilder Island3DEngine (full Grudge Three.js stack).
 * Pirate Islands / Chicken Gun lobby GLTF is the canonical starting test scene.
 */
import type { WarlordsCharacter } from './warlordsCharacter';
import { createFreePlayCharacter } from './freePlayRoster';
import { getActiveCharacter, getCharacterIdFromHash } from './characterSession';
import { fetchWarlordsCharacter } from './warlordsCharacter';
import { resolveFreePlayFromId } from './freePlayRoster';

/** Grudge Warlords client — Island3DEngine, CharacterController3D, Colyseus. */
export const GRUDGE_CLIENT_BASE = import.meta.env.VITE_GRUDGE_CLIENT_BASE
  ?? (import.meta.env.DEV ? 'http://localhost:5173' : 'https://client.grudge-studio.com');

/** PolygonPirates lobby GLTF — Chicken Gun–style pirate islands starting map. */
export const PIRATE_LOBBY_MAP = 'pirate-islands';

export type EngineSceneMode = 'lobby' | 'zone' | 'play';

export interface EngineLaunchOptions {
  /** lobby = pirate-islands GLTF; zone = procedural sector; play = Colyseus open world */
  mode?: EngineSceneMode;
  map?: string;
  sector?: string;
  solo?: boolean;
  characterId?: string;
}

/** Build island-3d legacy engine URL (lobby pirate map by default). */
export function buildIsland3DUrl(opts: EngineLaunchOptions = {}): string {
  const mode = opts.mode ?? 'lobby';
  const params = new URLSearchParams({
    engine: 'legacy',
    mode,
  });

  if (mode === 'lobby') {
    params.set('map', opts.map ?? PIRATE_LOBBY_MAP);
  } else if (mode === 'zone') {
    params.set('sector', opts.sector ?? 'haven_shore');
    params.set('worldSeed', 'grudge-world-1');
    if (opts.solo !== false) params.set('solo', '1');
  }

  if (opts.characterId) params.set('characterId', opts.characterId);

  return `${GRUDGE_CLIENT_BASE}/island-3d?${params.toString()}`;
}

/** Full Colyseus open world (/play) — convergence nexus hub (CENTER pirate biome). */
export function buildPlayWorldUrl(): string {
  return `${GRUDGE_CLIENT_BASE}/play`;
}

export function buildPirateTestUrl(char?: WarlordsCharacter | null): string {
  return buildIsland3DUrl({
    mode: 'lobby',
    map: PIRATE_LOBBY_MAP,
    characterId: char?.id,
  });
}

export async function resolveLaunchCharacter(): Promise<WarlordsCharacter> {
  let char = getActiveCharacter();
  const charId = getCharacterIdFromHash();
  if (charId && (!char || char.id !== charId)) {
    char = resolveFreePlayFromId(charId) ?? (await fetchWarlordsCharacter(charId));
  }
  return char ?? createFreePlayCharacter('human', 'warrior');
}

/** Navigate to the Chicken Gun pirate islands test scene (Island3DEngine lobby). */
export async function launchPirateTestScene(): Promise<void> {
  const char = await resolveLaunchCharacter();
  window.location.assign(buildPirateTestUrl(char));
}