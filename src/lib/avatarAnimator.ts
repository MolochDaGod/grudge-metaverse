import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  GRUDGE6_ANIMATION_URLS,
  type LocomotionState,
} from './grudge6Animations';

const LOADER = new GLTFLoader();

export class AvatarAnimator {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<LocomotionState, THREE.AnimationAction>();
  private current: LocomotionState = 'idle';
  private loaded = false;

  constructor(root: THREE.Object3D) {
    this.mixer = new THREE.AnimationMixer(root);
  }

  async load(): Promise<void> {
    const entries: [LocomotionState, string][] = [
      ['idle', GRUDGE6_ANIMATION_URLS.idle],
      ['walk', GRUDGE6_ANIMATION_URLS.walk],
      ['run', GRUDGE6_ANIMATION_URLS.run],
    ];

    for (const [state, url] of entries) {
      try {
        const gltf = await LOADER.loadAsync(url);
        const clip = gltf.animations[0];
        if (!clip) continue;
        clip.name = state;
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        this.actions.set(state, action);
      } catch (err) {
        console.warn(`[metaverse] Animation load failed (${state}):`, err);
      }
    }

    const idle = this.actions.get('idle') ?? this.actions.get('walk');
    if (idle) {
      idle.play();
      this.current = this.actions.has('idle') ? 'idle' : 'walk';
    }
    this.loaded = true;
  }

  setLocomotion(state: LocomotionState, sprinting = false): void {
    if (!this.loaded) return;
    const target: LocomotionState =
      state === 'idle' ? 'idle' : sprinting && this.actions.has('run') ? 'run' : 'walk';
    if (target === this.current) return;

    const next = this.actions.get(target);
    const prev = this.actions.get(this.current);
    if (!next) return;

    next.reset().fadeIn(0.2).play();
    prev?.fadeOut(0.2);
    this.current = target;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.actions.clear();
  }
}