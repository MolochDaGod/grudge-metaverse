/**
 * Bridge metaverse lobby characters → Character-Animator-two /game/world.
 * Single animation/controller stack: grudge-game WorldPage + GameCharacter.
 */
import type { WarlordsCharacter } from './warlordsCharacter';
import { createFreePlayCharacter } from './freePlayRoster';
import { getActiveCharacter, getCharacterIdFromHash } from './characterSession';
import { fetchWarlordsCharacter } from './warlordsCharacter';
import { resolveFreePlayFromId } from './freePlayRoster';

/** character-kit RaceId (grudge-game panelStore / GameCharacter). */
export type KitRaceId =
  | 'western-kingdoms'
  | 'barbarians'
  | 'high-elves'
  | 'dwarves'
  | 'orcs'
  | 'undead';

const METAVERSE_TO_KIT_RACE: Record<string, KitRaceId> = {
  human: 'western-kingdoms',
  barbarian: 'barbarians',
  elf: 'high-elves',
  dwarf: 'dwarves',
  orc: 'orcs',
  undead: 'undead',
  worge: 'barbarians',
};

const VALID_CLASSES = new Set(['warrior', 'mage', 'ranger', 'worg']);

/** Host serving grudge-game (base path /game). Proxied in prod via vercel.json. */
export const GRUDGE_GAME_BASE = import.meta.env.VITE_GRUDGE_GAME_BASE
  ?? (import.meta.env.DEV ? 'http://localhost:3000/game' : 'https://client.grudge-studio.com/game');

export function metaverseRaceToKit(raceId: string): KitRaceId {
  return METAVERSE_TO_KIT_RACE[raceId] ?? 'western-kingdoms';
}

export function normalizeClassId(classId: string): string {
  return VALID_CLASSES.has(classId) ? classId : 'warrior';
}

export function buildWorldUrl(char: WarlordsCharacter): string {
  const race = metaverseRaceToKit(char.raceId);
  const cls = normalizeClassId(char.classId || 'warrior');
  const params = new URLSearchParams({ race, class: cls });
  if (char.id) params.set('char', char.id);
  if (char.name) params.set('name', char.name);
  return `${GRUDGE_GAME_BASE}/world?${params.toString()}`;
}

/** Resolve lobby / deep-link character then navigate to the real world scene. */
export async function launchGrudgeGameWorld(): Promise<void> {
  let char = getActiveCharacter();
  const charId = getCharacterIdFromHash();
  if (charId && (!char || char.id !== charId)) {
    char = resolveFreePlayFromId(charId) ?? (await fetchWarlordsCharacter(charId));
  }
  if (!char) char = createFreePlayCharacter('human', 'warrior');
  window.location.assign(buildWorldUrl(char));
}