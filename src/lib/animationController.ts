/**
 * AnimationController — GLTF clip registry + crossfade (Grudge Warlords pattern).
 */
import * as THREE from 'three';

const MIXAMO_PREFIXES = [
  'mixamorig10:', 'mixamorig9:', 'mixamorig8:', 'mixamorig7:', 'mixamorig6:',
  'mixamorig5:', 'mixamorig4:', 'mixamorig3:', 'mixamorig2:', 'mixamorig1:', 'mixamorig:',
];

function stripMixamoPrefix(boneName: string): string {
  for (const prefix of MIXAMO_PREFIXES) {
    if (boneName.startsWith(prefix)) return boneName.slice(prefix.length);
  }
  if (boneName.startsWith('mixamorig')) return boneName.slice('mixamorig'.length);
  return boneName;
}

export function remapMixamoClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const out = clip.clone();
  for (const track of out.tracks) {
    const dot = track.name.indexOf('.');
    if (dot === -1) continue;
    const bone = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    const stripped = stripMixamoPrefix(bone);
    if (stripped !== bone) track.name = stripped + prop;
  }
  return out;
}

export function fadeToAction(
  current: THREE.AnimationAction | null,
  next: THREE.AnimationAction,
  duration = 0.2,
  loop = true,
  speed = 1,
): THREE.AnimationAction {
  next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  next.clampWhenFinished = !loop;
  next.timeScale = speed;
  if (current && current !== next) {
    if (duration > 0) {
      next.reset().play();
      current.crossFadeTo(next, duration, true);
    } else {
      current.stop();
      next.reset().play();
    }
  } else {
    next.reset().play();
  }
  return next;
}

export type LocomotionState = 'idle' | 'walk' | 'run';

export class AnimationController {
  readonly mixer: THREE.AnimationMixer;
  readonly root: THREE.Object3D;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private currentState = '';

  constructor(mixer: THREE.AnimationMixer, root: THREE.Object3D) {
    this.mixer = mixer;
    this.root = root;
  }

  registerClip(name: string, clip: THREE.AnimationClip): void {
    const action = this.mixer.clipAction(clip, this.root);
    this.actions.set(name, action);
  }

  registerEmbeddedClips(clips: THREE.AnimationClip[]): void {
    for (const clip of clips) {
      const key = clip.name.toLowerCase();
      this.registerClip(key, clip);
    }
  }

  async loadExternalClips(urls: Partial<Record<LocomotionState, string>>): Promise<void> {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    for (const [state, url] of Object.entries(urls) as [LocomotionState, string][]) {
      if (!url || this.actions.has(state)) continue;
      try {
        const gltf = await loader.loadAsync(url);
        const raw = gltf.animations[0];
        if (!raw) continue;
        raw.name = state;
        this.registerClip(state, remapMixamoClip(raw));
      } catch (err) {
        console.warn(`[metaverse] External anim failed (${state}):`, err);
      }
    }
  }

  play(state: string, opts?: { fade?: number; speed?: number; loop?: boolean }): boolean {
    const action = this.actions.get(state);
    if (!action) return false;
    if (this.currentState === state && this.current?.isRunning()) return true;
    this.current = fadeToAction(
      this.current,
      action,
      opts?.fade ?? 0.2,
      opts?.loop ?? true,
      opts?.speed ?? 1,
    );
    this.currentState = state;
    return true;
  }

  setLocomotion(state: LocomotionState, sprinting = false): void {
    const target = state === 'idle' ? 'idle' : sprinting && this.actions.has('run') ? 'run' : 'walk';
    this.play(target);
  }

  hasClip(state: string): boolean {
    return this.actions.has(state);
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.actions.clear();
    this.current = null;
    this.currentState = '';
  }
}