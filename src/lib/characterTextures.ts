/**
 * Race body atlas textures — Character-Animator-two viewer pattern.
 * Baked metaverse GLBs ship a 1×1 placeholder; we apply the real atlas at runtime.
 */
import * as THREE from 'three';
import { ASSETS_CDN } from './warlordsCharacter';

const VIEWER_ASSET_HOST = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_CHARACTER_ASSET_BASE as string | undefined) ?? ASSETS_CDN;

/** Viewer-relative paths (same layout as character-viewer/public/assets). */
const RACE_TEXTURE_REL: Record<string, string> = {
  human: '/assets/western-kingdoms/textures/WK_Standard_Units.webp',
  barbarian: '/assets/barbarians/textures/BRB_StandardUnits_texture.webp',
  elf: '/assets/elves/textures/ELF_HighElves_Texture.webp',
  dwarf: '/assets/dwarves/textures/DWF_Standard_Units.webp',
  orc: '/assets/orcs/textures/ORC_StandardUnits.webp',
  undead: '/assets/undead/textures/UD_Standard_Units.webp',
  worge: '/assets/barbarians/textures/BRB_StandardUnits_texture.webp',
};

const CDN_TEXTURE: Record<string, string> = {
  human: `${ASSETS_CDN}/models/grudge6/textures/human.webp`,
  barbarian: `${ASSETS_CDN}/models/grudge6/textures/barbarian.webp`,
  elf: `${ASSETS_CDN}/models/grudge6/textures/elf.webp`,
  dwarf: `${ASSETS_CDN}/models/grudge6/textures/dwarf.webp`,
  orc: `${ASSETS_CDN}/models/grudge6/textures/orc.webp`,
  undead: `${ASSETS_CDN}/models/grudge6/textures/undead.webp`,
};

function textureCandidates(raceId: string): string[] {
  const id = raceId || 'human';
  const out: string[] = [
    `/models/grudge6/textures/${id}.webp`,
    CDN_TEXTURE[id],
  ].filter(Boolean) as string[];
  const rel = RACE_TEXTURE_REL[id] ?? RACE_TEXTURE_REL.human;
  if (VIEWER_ASSET_HOST) out.push(`${VIEWER_ASSET_HOST}${rel}`);
  else out.push(rel);
  return [...new Set(out)];
}

const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

export async function loadRaceBodyTexture(raceId: string): Promise<THREE.Texture | null> {
  for (const url of textureCandidates(raceId)) {
    try {
      const tex = await loader.loadAsync(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      return tex;
    } catch {
      console.warn(`[metaverse] Texture miss: ${url}`);
    }
  }
  return null;
}

/** Flat toon body material — matches character-kit applyBodyTexture. */
export function applyBodyTexture(root: THREE.Object3D, texture: THREE.Texture): void {
  const material = new THREE.MeshLambertMaterial({ map: texture, color: 0xffffff });
  root.traverse((node) => {
    const mesh = node as THREE.Mesh & { isSkinnedMesh?: boolean };
    if (!mesh.isMesh && !mesh.isSkinnedMesh) return;
    const name = mesh.name || '';
    if (/weapon|shield|Xtra_|container/i.test(name)) return;
    mesh.material = material;
  });
}