import type { GroundRay } from './animator/footIk';
import { GameAnimator } from './animator/gameAnimator';

export interface AnimatorUpdateOpts {
  footIk?: boolean;
  groundRay?: GroundRay;
  grounded?: boolean;
  moving?: boolean;
}

/** Facade over GameAnimator for the live play/game loop. */
export class AvatarAnimator {
  constructor(private readonly game: GameAnimator) {}

  static fromGame(game: GameAnimator): AvatarAnimator {
    return new AvatarAnimator(game);
  }

  setGait(moving: boolean, sprinting: boolean): void {
    this.game.setGait(moving, sprinting);
  }

  requestAttack(): void {
    this.game.requestAttack();
  }

  requestHit(): void {
    this.game.requestHit();
  }

  update(dt: number, opts?: AnimatorUpdateOpts): void {
    this.game.update(dt, opts);
  }

  dispose(): void {
    this.game.dispose();
  }
}