import type { AnimationController } from './animationController';
import type { LocomotionState } from './grudge6Animations';

/** Thin facade over AnimationController for the play loop. */
export class AvatarAnimator {
  constructor(private readonly ctrl: AnimationController) {}

  static fromController(ctrl: AnimationController): AvatarAnimator {
    return new AvatarAnimator(ctrl);
  }

  setLocomotion(state: LocomotionState, sprinting = false): void {
    this.ctrl.setLocomotion(state, sprinting);
  }

  update(dt: number): void {
    this.ctrl.update(dt);
  }

  dispose(): void {
    this.ctrl.dispose();
  }
}