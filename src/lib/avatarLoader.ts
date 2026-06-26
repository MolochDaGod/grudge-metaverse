import * as THREE from 'three';
import type { WarlordsCharacter } from './warlordsCharacter';
import { loadGltfCharacter } from './gltfCharacterLoader';
import { AvatarAnimator } from './avatarAnimator';

export interface LoadedAvatar {
  group: THREE.Group;
  animator: AvatarAnimator | null;
  height: number;
}

export async function loadWarlordsAvatar(
  char: WarlordsCharacter,
): Promise<LoadedAvatar> {
  const loaded = await loadGltfCharacter(char);
  loaded.group.userData.clipCount = loaded.clipCount;
  return {
    group: loaded.group,
    animator: AvatarAnimator.fromGame(loaded.animator),
    height: 2.8,
  };
}

export function createFallbackAvatar(name: string): LoadedAvatar {
  const player = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.4, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xc8a84b, roughness: 0.5, metalness: 0.3 }),
  );
  body.position.y = 1.2;
  body.castShadow = true;
  player.add(body);
  player.userData.characterName = name;
  return { group: player, animator: null, height: 2.4 };
}