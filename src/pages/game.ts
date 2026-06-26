/**
 * Game test scene — live grudge6 baked avatars with gait blend, foot IK, and combat.
 * Mirrors Character-Animator-two /game/world patterns for metaverse validation.
 */
import { mountPlay } from './play';

export function mountGame(container: HTMLElement): () => void {
  return mountPlay(container, {
    mode: 'game',
    footIk: true,
    title: 'GRUDGE6 GAME TEST',
    subtitle: 'Baked Bip001 · gait blend · foot IK',
  });
}