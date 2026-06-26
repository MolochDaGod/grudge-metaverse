/**
 * Ported from Character-Animator-two (grudge-game/world/animDirector.ts).
 * Gait-blended locomotion + one-shot overlay channel for live game scenes.
 */
import * as THREE from 'three';

export interface LocoClips {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
  sprint: THREE.AnimationClip;
}

export interface OneShotOpts {
  fade?: number;
  timeScale?: number;
  blend?: number;
  onEnd?: () => void;
}

type LocoState = keyof LocoClips;

const BANDS: { state: LocoState; at: number }[] = [
  { state: 'idle', at: 0 },
  { state: 'walk', at: 0.34 },
  { state: 'run', at: 0.7 },
  { state: 'sprint', at: 1 },
];

const GAIT_RATE = 9;

function clampBlend(v: number | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

export class AnimationDirector {
  readonly mixer: THREE.AnimationMixer;
  private loco: Record<LocoState, THREE.AnimationAction>;
  private locoTimeScale: Record<LocoState, number> = {
    idle: 1,
    walk: 1,
    run: 1,
    sprint: 1,
  };

  private gait = 0;
  private gaitTarget = 0;

  private overlay: THREE.AnimationAction | null = null;
  private overlayLoop = false;
  private overlayFade = 0.12;
  private overlayInf = 0;
  private overlayTarget = 0;
  private finishing = false;
  private overlayEnd: (() => void) | null = null;
  private overlayClones = new Map<string, THREE.AnimationClip>();
  private buffered: { clip: THREE.AnimationClip; opts: OneShotOpts } | null = null;

  constructor(mixer: THREE.AnimationMixer, clips: LocoClips) {
    this.mixer = mixer;
    const mk = (clip: THREE.AnimationClip): THREE.AnimationAction => {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      return a;
    };
    this.loco = {
      idle: mk(clips.idle),
      walk: mk(clips.walk),
      run: mk(clips.run),
      sprint: mk(clips.sprint),
    };
    this.loco.idle.setEffectiveWeight(1);
    this.mixer.addEventListener('finished', this.onFinished);
  }

  get busy(): boolean {
    return this.overlay !== null && !this.overlayLoop && !this.finishing;
  }

  setGaitTarget(moving: boolean, sprinting: boolean): void {
    this.gaitTarget = !moving ? 0 : sprinting ? 1 : 0.7;
  }

  private overlayActionFor(clip: THREE.AnimationClip): THREE.AnimationAction {
    let c = this.overlayClones.get(clip.uuid);
    if (!c) {
      c = clip.clone();
      this.overlayClones.set(clip.uuid, c);
    }
    return this.mixer.clipAction(c);
  }

  playOneShot(clip: THREE.AnimationClip, opts: OneShotOpts = {}): void {
    if (this.overlay) this.overlay.stop();
    const a = this.overlayActionFor(clip);
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = opts.timeScale ?? 1;
    a.setEffectiveWeight(1);
    a.play();
    this.overlay = a;
    this.overlayLoop = false;
    this.overlayFade = opts.fade ?? 0.12;
    this.overlayTarget = clampBlend(opts.blend);
    this.finishing = false;
    this.overlayEnd = opts.onEnd ?? null;
    this.buffered = null;
  }

  requestOneShot(clip: THREE.AnimationClip, opts: OneShotOpts = {}): void {
    if (this.overlay && !this.overlayLoop && !this.finishing) {
      const remaining = this.overlay.getClip().duration - this.overlay.time;
      if (remaining > (opts.fade ?? 0.12)) {
        this.buffered = { clip, opts };
        return;
      }
    }
    this.playOneShot(clip, opts);
  }

  private onFinished = (e: { action: THREE.AnimationAction }): void => {
    if (this.overlay && e.action === this.overlay && !this.overlayLoop) {
      this.finishing = true;
      this.overlayTarget = 0;
    }
  };

  update(delta: number): void {
    this.gait += (this.gaitTarget - this.gait) * (1 - Math.exp(-GAIT_RATE * delta));
    const w: Record<LocoState, number> = { idle: 0, walk: 0, run: 0, sprint: 0 };
    if (this.gait >= 1) {
      w.sprint = 1;
    } else {
      for (let i = 0; i < BANDS.length - 1; i++) {
        const a = BANDS[i];
        const b = BANDS[i + 1];
        if (this.gait >= a.at && this.gait <= b.at) {
          const t = (this.gait - a.at) / (b.at - a.at);
          w[a.state] = 1 - t;
          w[b.state] = t;
          break;
        }
      }
    }

    if (this.overlay) {
      const k = 1 - Math.exp(-(1 / Math.max(0.02, this.overlayFade)) * delta);
      this.overlayInf += (this.overlayTarget - this.overlayInf) * k;

      if (this.buffered && !this.overlayLoop && !this.finishing) {
        const remaining = this.overlay.getClip().duration - this.overlay.time;
        if (remaining <= this.overlayFade) {
          const b = this.buffered;
          this.buffered = null;
          this.playOneShot(b.clip, b.opts);
        }
      }

      if (this.finishing && this.overlayInf < 0.02) {
        this.overlay.stop();
        const end = this.overlayEnd;
        this.overlay = null;
        this.overlayEnd = null;
        this.finishing = false;
        this.overlayInf = 0;
        if (end) end();
      }
    } else {
      this.overlayInf = 0;
    }

    const locoScale = 1 - this.overlayInf;
    this.loco.idle.setEffectiveWeight(w.idle * locoScale);
    this.loco.walk.setEffectiveWeight(w.walk * locoScale);
    this.loco.run.setEffectiveWeight(w.run * locoScale);
    this.loco.sprint.setEffectiveWeight(w.sprint * locoScale);
    if (this.overlay) this.overlay.setEffectiveWeight(this.overlayInf);

    this.mixer.update(delta);
  }

  dispose(): void {
    this.mixer.removeEventListener('finished', this.onFinished);
    this.overlayClones.clear();
  }
}