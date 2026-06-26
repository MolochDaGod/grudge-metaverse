/**
 * #/play — hands off to GrudgeBuilder Island3DEngine (pirate test scene).
 * Same stack as #/test; kept for older deep links.
 */
import { mountTest } from './test';

export function mountPlay(container: HTMLElement): () => void {
  return mountTest(container);
}