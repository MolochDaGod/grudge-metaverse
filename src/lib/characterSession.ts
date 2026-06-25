import type { WarlordsCharacter } from './warlordsCharacter';

const KEY = 'grudge_metaverse_character';

export function setActiveCharacter(char: WarlordsCharacter): void {
  sessionStorage.setItem(KEY, JSON.stringify(char));
}

export function getActiveCharacter(): WarlordsCharacter | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WarlordsCharacter;
  } catch {
    return null;
  }
}

export function getCharacterIdFromHash(): string | null {
  const hash = window.location.hash;
  const q = hash.indexOf('?');
  if (q === -1) return null;
  return new URLSearchParams(hash.slice(q + 1)).get('char');
}

export function clearActiveCharacter(): void {
  sessionStorage.removeItem(KEY);
}