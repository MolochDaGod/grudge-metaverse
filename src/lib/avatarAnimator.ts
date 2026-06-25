import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  GRUDGE6_ANIMATION_URLS,
  type LocomotionState,
} from './grudge6Animations';
import { remapClipForRig } from './grudge6Skeleton';

const LOADER = new GLTFLoader();

export class AvatarAnimator {
  readonly mixer: THREE.AnimationMixer;
  private readonly animRoot: THREE.Object3D;
  private readonly boneNames: Set<string>;
  private actions = new Map<LocomotionState, THREE.AnimationAction>();
  private current: LocomotionState = 'idle';
  private loaded = false;

  constructor(animRoot: THREE.Object3D, boneNames: Set<string>) {
    this.animRoot = animRoot;
    this.boneNames = boneNames;
    this.mixer = new THREE.AnimationMixer(animRoot);
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
        const raw = gltf.animations[0];
        if (!raw) continue;

        const clip = remapClipForRig(raw, this.boneNames);
        clip.name = state;

        const matched = clip.tracks.some((t) => {
          const bone = t.name.split('.')[0];
          return this.boneNames.has(bone);
        });
        if (!matched) {
          console.warn(`[metaverse] No matching bones for "${state}" on rig`);
          continue;
        }

        const action = this.mixer.clipAction(clip, this.animRoot);
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
      this.loaded = true;
    } else {
      console.warn('[metaverse] No locomotion clips bound to skeleton');
    }
  }

  setLocomotion(state: LocomotionState, sprinting = false): void {
    if (!this.loaded) return;

    const target: LocomotionState =
      state === 'idle'
        ? 'idle'
        : sprinting && this.actions.has('run')
          ? 'run'
          : 'walk';

    if (target === this.current) return;

    const next = this.actions.get(target);
    const prev = this.actions.get(this.current);
    if (!next) return;

    if (prev && prev !== next) {
      prev.fadeOut(0.2);
      next.reset().fadeIn(0.2).play();
    } else {
      next.reset().play();
    }
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