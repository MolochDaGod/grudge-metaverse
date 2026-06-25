import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  buildModel3d,
  resolveRaceModelUrl,
  type WarlordsCharacter,
} from './warlordsCharacter';
import { applyModel3d, Grudge6EquipmentManager } from './grudge6Equipment';

export async function loadWarlordsAvatar(
  char: WarlordsCharacter,
): Promise<THREE.Group> {
  const model3d = buildModel3d(char);
  const url = resolveRaceModelUrl(char.raceId);

  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.scale.setScalar(model3d.scale);

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const em = new Grudge6EquipmentManager(model3d.prefix);
  em.catalog(root);
  applyModel3d(em, model3d);

  const wrapper = new THREE.Group();
  wrapper.add(root);
  wrapper.userData.characterId = char.id;
  wrapper.userData.characterName = char.name;
  return wrapper;
}

export function createFallbackAvatar(name: string): THREE.Group {
  const player = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.4, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xc8a84b, roughness: 0.5, metalness: 0.3 }),
  );
  body.position.y = 1.2;
  body.castShadow = true;
  player.add(body);
  player.userData.characterName = name;
  return player;
}