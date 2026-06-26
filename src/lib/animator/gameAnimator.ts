/**
 * Live-game animator — Character-Animator-two AnimationDirector + foot IK
 * for grudge6 metaverse bundled GLB avatars.
 */
import * as THREE from 'three';
import { AnimationDirector } from './animationDirector';
import { FootIkRig, type GroundRay } from './footIk';
import { FOOT_IK } from './footIkMath';

function findClip(clips: THREE.AnimationClip[], ...names: string[]): THREE.AnimationClip | null {
  const lower = new Map(clips.map((c) => [c.name.toLowerCase(), c]));
  for (const name of names) {
    const hit = lower.get(name.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function pickLocoClips(clips: THREE.AnimationClip[]) {
  const idle = findClip(clips, 'idle') ?? clips[0];
  if (!idle) throw new Error('No animation clips on avatar GLB');
  const walk = findClip(clips, 'walk') ?? idle;
  const run = findClip(clips, 'run', 'walk') ?? walk;
  const sprint = run.clone();
  sprint.name = 'sprint';
  return { idle, walk, run, sprint };
}

export class GameAnimator {
  readonly director: AnimationDirector;
  readonly footIk: FootIkRig;
  readonly attackClip: THREE.AnimationClip | null;
  readonly hitClip: THREE.AnimationClip | null;
  private animRoot: THREE.Object3D;

  constructor(animRoot: THREE.Object3D, embeddedClips: THREE.AnimationClip[]) {
    this.animRoot = animRoot;
    const loco = pickLocoClips(embeddedClips);
    const mixer = new THREE.AnimationMixer(animRoot);
    this.director = new AnimationDirector(mixer, loco);
    this.footIk = new FootIkRig(animRoot);
    this.attackClip = findClip(embeddedClips, 'attack');
    this.hitClip = findClip(embeddedClips, 'hit');
  }

  setGait(moving: boolean, sprinting: boolean): void {
    this.director.setGaitTarget(moving, sprinting);
  }

  requestAttack(): void {
    if (!this.attackClip || this.director.busy) return;
    this.director.requestOneShot(this.attackClip, { fade: 0.15 });
  }

  requestHit(): void {
    if (!this.hitClip) return;
    this.director.requestOneShot(this.hitClip, { fade: 0.12, blend: 0.85 });
  }

  update(dt: number, opts?: { footIk?: boolean; groundRay?: GroundRay; grounded?: boolean; moving?: boolean }): void {
    this.director.update(dt);
    if (opts?.footIk && opts.groundRay && this.footIk.valid) {
      const active = Boolean(opts.grounded && opts.moving && !this.director.busy);
      this.footIk.apply(opts.groundRay, active, dt, FOOT_IK);
    }
  }

  dispose(): void {
    this.director.dispose();
    this.director.mixer.stopAllAction();
  }
}