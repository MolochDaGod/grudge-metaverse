/**
 * Grudge6 Bip001 skeleton helpers — bone discovery, clip remapping, model prep.
 */
import * as THREE from 'three';

export interface Grudge6Rig {
  animRoot: THREE.Object3D;
  skinnedMesh: THREE.SkinnedMesh | null;
  boneNames: Set<string>;
  height: number;
}

/** Mixamo → Bip001 (Blender retarget map, both space naming conventions). */
const MIXAMO_TO_BIP: Record<string, string> = {
  mixamorigHips: 'Bip001 Pelvis',
  mixamorigSpine: 'Bip001 Spine',
  mixamorigSpine1: 'Bip001 Spine1',
  mixamorigSpine2: 'Bip001 Spine2',
  mixamorigNeck: 'Bip001 Neck',
  mixamorigHead: 'Bip001 Head',
  mixamorigLeftShoulder: 'Bip001 L Clavicle',
  mixamorigLeftArm: 'Bip001 L UpperArm',
  mixamorigLeftForeArm: 'Bip001 L Forearm',
  mixamorigLeftHand: 'Bip001 L Hand',
  mixamorigRightShoulder: 'Bip001 R Clavicle',
  mixamorigRightArm: 'Bip001 R UpperArm',
  mixamorigRightForeArm: 'Bip001 R Forearm',
  mixamorigRightHand: 'Bip001 R Hand',
  mixamorigLeftUpLeg: 'Bip001 L Thigh',
  mixamorigLeftLeg: 'Bip001 L Calf',
  mixamorigLeftFoot: 'Bip001 L Foot',
  mixamorigLeftToeBase: 'Bip001 L Toe0',
  mixamorigRightUpLeg: 'Bip001 R Thigh',
  mixamorigRightLeg: 'Bip001 R Calf',
  mixamorigRightFoot: 'Bip001 R Foot',
  mixamorigRightToeBase: 'Bip001 R Toe0',
};

const MIXAMO_PREFIXES = [
  'mixamorig10:', 'mixamorig9:', 'mixamorig8:', 'mixamorig7:', 'mixamorig6:',
  'mixamorig5:', 'mixamorig4:', 'mixamorig3:', 'mixamorig2:', 'mixamorig1:', 'mixamorig:',
];

function stripMixamoPrefix(name: string): string {
  for (const prefix of MIXAMO_PREFIXES) {
    if (name.startsWith(prefix)) return name.slice(prefix.length);
  }
  return name;
}

function boneVariants(name: string): string[] {
  const variants = new Set<string>([name]);
  variants.add(name.replace(/ /g, '_'));
  variants.add(name.replace(/_/g, ' '));
  return [...variants];
}

export function resolveBoneOnRig(preferred: string, boneNames: Set<string>): string | null {
  for (const variant of boneVariants(preferred)) {
    if (boneNames.has(variant)) return variant;
  }
  return null;
}

export function inspectGrudge6Model(root: THREE.Object3D): Grudge6Rig {
  const boneNames = new Set<string>();
  let skinnedMesh: THREE.SkinnedMesh | null = null;

  root.traverse((child) => {
    if (child.name) boneNames.add(child.name);
    const mesh = child as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh && mesh.skeleton) {
      if (!skinnedMesh) skinnedMesh = mesh;
      for (const bone of mesh.skeleton.bones) {
        if (bone.name) boneNames.add(bone.name);
      }
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const height = Math.max(0.01, box.max.y - box.min.y);

  return {
    animRoot: root,
    skinnedMesh,
    boneNames,
    height,
  };
}

/**
 * Remap animation track bone names to match the loaded grudge6 rig.
 * Handles Mixamo idle clips + Bip001 retargeted clips (space vs underscore).
 */
export function remapClipForRig(
  clip: THREE.AnimationClip,
  boneNames: Set<string>,
): THREE.AnimationClip {
  const out = clip.clone();
  let mapped = 0;

  for (const track of out.tracks) {
    const dot = track.name.indexOf('.');
    if (dot === -1) continue;

    const sourceBone = track.name.slice(0, dot);
    const property = track.name.slice(dot);
    let targetBone = sourceBone;

    const stripped = stripMixamoPrefix(sourceBone);
    const mixamoKey = stripped.startsWith('mixamorig') ? stripped : `mixamorig${stripped}`;
    const bipFromMixamo = MIXAMO_TO_BIP[sourceBone]
      ?? MIXAMO_TO_BIP[stripped]
      ?? MIXAMO_TO_BIP[mixamoKey];

    if (bipFromMixamo) {
      targetBone = resolveBoneOnRig(bipFromMixamo, boneNames) ?? sourceBone;
    } else if (/^Bip001/i.test(sourceBone)) {
      targetBone = resolveBoneOnRig(sourceBone, boneNames) ?? sourceBone;
    } else if (boneNames.has(stripped) && stripped !== sourceBone) {
      targetBone = stripped;
    }

    if (targetBone !== sourceBone) {
      track.name = targetBone + property;
      mapped++;
    }
  }

  if (mapped === 0 && out.tracks.length > 0) {
    console.warn(`[metaverse] Clip "${clip.name}" — no bone tracks matched rig`);
  }

  return out;
}

/** Scale to target height, ground feet at y=0, center XZ (playground SmartLoader pattern). */
export function prepareGrudge6Model(
  model: THREE.Object3D,
  opts: { targetHeight?: number; raceScale?: number; shadows?: boolean } = {},
): Grudge6Rig {
  const { targetHeight = 2.8, raceScale = 1, shadows = true } = opts;

  const box = new THREE.Box3().setFromObject(model);
  const height = box.max.y - box.min.y;
  if (height > 0) {
    const scale = (targetHeight / height) * raceScale;
    model.scale.setScalar(scale);
  }

  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.y = -scaledBox.min.y;
  model.position.x = -(scaledBox.min.x + scaledBox.max.x) / 2;
  model.position.z = -(scaledBox.min.z + scaledBox.max.z) / 2;

  if (shadows) {
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (mat) mat.side = THREE.DoubleSide;
        }
      }
    });
  }

  const rig = inspectGrudge6Model(model);
  rig.skinnedMesh?.skeleton?.pose();
  return rig;
}