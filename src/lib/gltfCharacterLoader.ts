/**
 * Load grudge6 character as GLTF — bundled avatar GLB with embedded animations + controller.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildModel3d, type WarlordsCharacter } from './warlordsCharacter';
import { applyModel3d, Grudge6EquipmentManager } from './grudge6Equipment';
import { prepareGrudge6Model } from './grudge6Skeleton';
import { AnimationController } from './animationController';
import {
  bundledAvatarUrl,
  fallbackRaceGlbUrl,
  FALLBACK_ANIMATION_URLS,
} from './characterManifest';

export interface GltfCharacter {
  group: THREE.Group;
  controller: AnimationController;
  clipCount: number;
}

const LOADER = new GLTFLoader();

async function tryLoadGltf(url: string) {
  try {
    return await LOADER.loadAsync(url);
  } catch {
    return null;
  }
}

export async function loadGltfCharacter(char: WarlordsCharacter): Promise<GltfCharacter> {
  const raceId = char.raceId || 'human';
  const model3d = buildModel3d(char);

  let gltf = await tryLoadGltf(bundledAvatarUrl(raceId));
  let source = 'bundled';
  if (!gltf) {
    gltf = await tryLoadGltf(fallbackRaceGlbUrl(raceId));
    source = 'race-glb';
  }
  if (!gltf) {
    throw new Error(`No GLTF avatar for race: ${raceId}`);
  }

  const root = gltf.scene;
  const em = new Grudge6EquipmentManager(model3d.prefix);
  em.catalog(root);
  applyModel3d(em, model3d);

  prepareGrudge6Model(root, {
    targetHeight: 2.8,
    raceScale: model3d.scale,
  });

  const wrapper = new THREE.Group();
  wrapper.add(root);
  wrapper.userData.characterId = char.id;
  wrapper.userData.characterName = char.name;
  wrapper.userData.avatarSource = source;

  const controller = new AnimationController(
    new THREE.AnimationMixer(root),
    root,
  );

  if (gltf.animations.length > 0) {
    controller.registerEmbeddedClips(gltf.animations);
  }

  if (!controller.hasClip('idle') || !controller.hasClip('walk')) {
    await controller.loadExternalClips(FALLBACK_ANIMATION_URLS);
  }

  controller.play(controller.hasClip('idle') ? 'idle' : 'walk');

  return {
    group: wrapper,
    controller,
    clipCount: gltf.animations.length,
  };
}