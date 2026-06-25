/**
 * Minimal grudge6 equipment mesh toggler for metaverse avatars.
 * Ported from GrudgeBuilder grudge6Equipment.ts
 */
import * as THREE from 'three';

interface SlotDef {
  slot: string;
  re: RegExp;
  group: string;
  noVariant?: boolean;
}

const SLOT_DEFS: SlotDef[] = [
  { slot: 'body', re: /^Units_Body_([A-Z])$/i, group: 'armor' },
  { slot: 'arms', re: /^Units_Arms_([A-Z])$/i, group: 'armor' },
  { slot: 'legs', re: /^Units_Legs_([A-Z])$/i, group: 'armor' },
  { slot: 'head', re: /^Units_head_([A-Z])$/i, group: 'armor' },
  { slot: 'shoulders', re: /^Units_shoulderpads_([A-Z])$/i, group: 'armor' },
  { slot: 'axe', re: /(?:Units_|weapon_)axe_([A-Z])$/i, group: 'weapon_r' },
  { slot: 'hammer', re: /(?:Units_|weapon_)hammer_([A-Z])$/i, group: 'weapon_r' },
  { slot: 'sword', re: /(?:Units_|weapon_)[Ss]word_([A-Z])$/i, group: 'weapon_r' },
  { slot: 'pick', re: /(?:Units_|weapon_)pick$/i, group: 'weapon_r', noVariant: true },
  { slot: 'spear', re: /(?:Units_|weapon_)[Ss]pear$/i, group: 'weapon_r', noVariant: true },
  { slot: 'bow', re: /(?:Units_|weapon_)[Bb]ow$/i, group: 'weapon_l', noVariant: true },
  { slot: 'staff', re: /(?:Units_|weapon_)staff_([A-Z])$/i, group: 'weapon_l' },
  { slot: 'shield', re: /(?:Units_|)[Ss]hield_([A-Z])$/i, group: 'shield' },
  { slot: 'bag', re: /(?:Xtra_|Units_)bag$/i, group: 'utility', noVariant: true },
  { slot: 'quiver', re: /(?:Xtra_|Units_)quiver$/i, group: 'utility', noVariant: true },
];

const WEAPON_SLOTS = new Set(['axe', 'hammer', 'sword', 'pick', 'spear', 'bow', 'staff', 'shield']);

export class Grudge6EquipmentManager {
  readonly prefix: string;
  slots: Record<string, Record<string, THREE.Object3D>> = {};
  private _allMeshes: THREE.Object3D[] = [];

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  catalog(root: THREE.Object3D): void {
    this.slots = {};
    this._allMeshes = [];

    root.traverse((child) => {
      const mesh = child as THREE.Mesh & { isSkinnedMesh?: boolean };
      if (!mesh.isMesh && !mesh.isSkinnedMesh) return;

      const stripped = mesh.name.startsWith(this.prefix)
        ? mesh.name.slice(this.prefix.length)
        : mesh.name;

      for (const def of SLOT_DEFS) {
        const match = stripped.match(def.re);
        if (!match) continue;

        const variant = def.noVariant ? '_default' : (match[1] || '_default').toUpperCase();
        if (!this.slots[def.slot]) this.slots[def.slot] = {};
        this.slots[def.slot][variant] = mesh;
        mesh.userData.equipSlot = def.slot;
        mesh.userData.equipGroup = def.group;
        this._allMeshes.push(mesh);
        mesh.visible = false;
        break;
      }
    });
  }

  equip(slot: string, variant: string, armorColor?: string): boolean {
    const variants = this.slots[slot];
    if (!variants) return false;

    for (const [v, mesh] of Object.entries(variants)) {
      const m = mesh as THREE.Mesh;
      if (v === variant) {
        m.visible = true;
        if (armorColor && m.material) this.tintMesh(m, armorColor);
      } else {
        m.visible = false;
      }
    }
    return true;
  }

  equipWeapon(slot: string, variant = '_default'): boolean {
    const def = SLOT_DEFS.find((d) => d.slot === slot);
    if (!def) return false;

    for (const mesh of this._allMeshes) {
      if (mesh.userData.equipGroup === def.group) {
        mesh.visible = false;
      }
    }
    return this.equip(slot, variant);
  }

  private tintMesh(mesh: THREE.Mesh, color: string): void {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat && (mat as THREE.MeshStandardMaterial).color) {
      (mat as THREE.MeshStandardMaterial).color.set(color);
    }
  }
}

export function applyModel3d(
  em: Grudge6EquipmentManager,
  model3d: {
    equippedMeshes?: Record<string, string>;
    weaponSlots?: Record<string, string>;
    armorColor?: string;
  },
): void {
  for (const [slot, variant] of Object.entries(model3d.equippedMeshes ?? {})) {
    em.equip(slot, variant, model3d.armorColor);
  }
  for (const [slot, variant] of Object.entries(model3d.weaponSlots ?? {})) {
    if (WEAPON_SLOTS.has(slot)) em.equipWeapon(slot, variant);
  }
}