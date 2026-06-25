/**
 * Grudge6 free-play roster — no Warlords API required.
 * Available to guests and signed-in users from the lobby.
 */
import {
  getRaceConfig,
  type WarlordsCharacter,
} from './warlordsCharacter';

/** Canonical grudge6 races — Human, Barbarian, Orc, Undead, Elf, Dwarf */
export const FREE_PLAY_RACE_IDS = [
  'human',
  'barbarian',
  'orc',
  'undead',
  'elf',
  'dwarf',
] as const;

export type FreePlayRaceId = (typeof FREE_PLAY_RACE_IDS)[number];

export const FREE_PLAY_CLASSES = [
  { id: 'warrior', label: 'Warrior' },
  { id: 'mage', label: 'Mage' },
  { id: 'ranger', label: 'Ranger' },
  { id: 'worg', label: 'Worge' },
] as const;

export function isFreePlayCharacter(char: WarlordsCharacter | null | undefined): boolean {
  return !!char?.id?.startsWith('freeplay_');
}

export function createFreePlayCharacter(
  raceId: FreePlayRaceId,
  classId = 'warrior',
): WarlordsCharacter {
  const race = getRaceConfig(raceId);
  return {
    id: `freeplay_${raceId}`,
    name: `${race.label} Recruit`,
    raceId,
    classId,
    level: 1,
    hp: 100,
    model3d: { scale: race.scale },
  };
}

/** Parse `freeplay_{race}` deep links and refresh-safe session restores. */
export function resolveFreePlayFromId(charId: string): WarlordsCharacter | null {
  if (!charId.startsWith('freeplay_')) return null;
  const raceId = charId.slice('freeplay_'.length) as FreePlayRaceId;
  if (!(FREE_PLAY_RACE_IDS as readonly string[]).includes(raceId)) return null;
  return createFreePlayCharacter(raceId);
}