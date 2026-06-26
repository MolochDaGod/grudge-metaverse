/**
 * Metaverse character loader — bundled GLB + body atlas + equipment + GameAnimator.
 * Follows Character-Animator-two viewer/game patterns (not the yellow fallback capsule).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildModel3d, type WarlordsCharacter } from './warlordsCharacter';
import { applyModel3d, Grudge6EquipmentManager } from './grudge6Equipment';
import { inspectGrudge6Model, prepareGrudge6Model } from './grudge6Skeleton';
import { remapMixamoClip } from './animationController';
import { GameAnimator } from './animator/gameAnimator';
import { applyBodyTexture, loadRaceBodyTexture } from './characterTextures';
import {
  avatarGlbCandidates,
  FALLBACK_ANIMATION_URLS,
} from './characterManifest';

export interface GltfCharacter {
  group: THREE.Group;
  animator: GameAnimator;
  clipCount: number;
  source: string;
}

const LOADER = new GLTFLoader();

type LoadedGltf = Awaited<ReturnType<typeof LOADER.loadAsync>>;

async function loadGltfFromUrl(url: string): Promise<LoadedGltf | null> {
  try {
    return await LOADER.loadAsync(url);
  } catch (err) {
    console.warn(`[metaverse] GLB failed: ${url}`, err);
    return null;
  }
}

function hasClip(clips: THREE.AnimationClip[], name: string): boolean {
  return clips.some((c) => c.name.toLowerCase() === name.toLowerCase());
}

async function loadFallbackClips(clips: THREE.AnimationClip[]): Promise<THREE.AnimationClip[]> {
  const out = [...clips];
  const needs = (['idle', 'walk', 'run'] as const).filter((s) => !hasClip(out, s));
  if (needs.length === 0) return out;

  for (const state of needs) {
    const url = FALLBACK_ANIMATION_URLS[state as keyof typeof FALLBACK_ANIMATION_URLS];
    if (!url) continue;
    try {
      const gltf = await LOADER.loadAsync(url);
      const raw = gltf.animations[0];
      if (!raw) continue;
      raw.name = state;
      out.push(remapMixamoClip(raw));
    } catch (err) {
      console.warn(`[metaverse] External anim failed (${state}):`, err);
    }
  }
  return out;
}

function findAnimRoot(scene: THREE.Object3D): THREE.Object3D {
  let armature: THREE.Object3D | null = null;
  scene.traverse((child) => {
    if (armature) return;
    if ((child as THREE.Bone).isBone && /^Bip001/i.test(child.name)) {
      let p: THREE.Object3D | null = child;
      while (p?.parent && p.parent !== scene) p = p.parent;
      armature = p ?? child;
    }
  });
  return armature ?? scene;
}

function orientForGame(model: THREE.Object3D): void {
  model.rotation.y = Math.PI / 2;
  model.updateMatrixWorld(true);
}

export async function loadGltfCharacter(char: WarlordsCharacter): Promise<GltfCharacter> {
  const raceId = char.raceId || 'human';
  const model3d = buildModel3d(char);

  let gltf: LoadedGltf | null = null;
  let source = '';
  for (const { url, label } of avatarGlbCandidates(raceId)) {
    gltf = await loadGltfFromUrl(url);
    if (gltf) {
      source = label;
      break;
    }
  }
  if (!gltf) {
    throw new Error(`No metaverse GLB for race "${raceId}" (tried bundled + CDN)`);
  }

  const root = gltf.scene;
  orientForGame(root);

  const em = new Grudge6EquipmentManager(model3d.prefix);
  em.catalog(root);
  applyModel3d(em, model3d);
  if (Object.keys(em.slots).length === 0) {
    console.warn(`[metaverse] No grudge6 equipment slots for prefix ${model3d.prefix}`);
  }

  const bodyTex = await loadRaceBodyTexture(raceId);
  if (bodyTex) applyBodyTexture(root, bodyTex);

  prepareGrudge6Model(root, {
    targetHeight: 2.8,
    raceScale: model3d.scale,
    resetPose: false,
  });

  const animRoot = findAnimRoot(root);
  inspectGrudge6Model(root);

  const wrapper = new THREE.Group();
  wrapper.add(root);
  wrapper.userData.characterId = char.id;
  wrapper.userData.characterName = char.name;
  wrapper.userData.avatarSource = source;
  wrapper.userData.raceId = raceId;

  let clips = gltf.animations.length > 0 ? [...gltf.animations] : [];
  if (!hasClip(clips, 'idle') || !hasClip(clips, 'walk')) {
    clips = await loadFallbackClips(clips);
  }
  if (clips.length === 0) {
    throw new Error(`Avatar "${raceId}" has no animation clips`);
  }

  const animator = new GameAnimator(animRoot, clips);

  return {
    group: wrapper,
    animator,
    clipCount: clips.length,
    source,
  };
}