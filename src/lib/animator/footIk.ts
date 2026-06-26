/**
 * Ported from Character-Animator-two (grudge-game/world/footIk.ts).
 * Supports grudge6 Bip001 space and underscore bone naming.
 */
import * as THREE from 'three';
import {
  clampReach,
  dampWeight,
  FOOT_IK,
  lawOfCosinesAngle,
  pelvisDrop,
  solveTwoBoneAngles,
  type FootIkTune,
} from './footIkMath';

export type GroundRay = (x: number, y: number, z: number) => number | null;

interface Leg {
  thigh: THREE.Object3D;
  calf: THREE.Object3D;
  foot: THREE.Object3D;
  restOffset: number;
}

const LEG_SETS = [
  {
    thigh: ['Bip001 L Thigh', 'Bip001_L_Thigh'],
    calf: ['Bip001 L Calf', 'Bip001_L_Calf'],
    foot: ['Bip001 L Foot', 'Bip001_L_Foot'],
  },
  {
    thigh: ['Bip001 R Thigh', 'Bip001_R_Thigh'],
    calf: ['Bip001 R Calf', 'Bip001_R_Calf'],
    foot: ['Bip001 R Foot', 'Bip001_R_Foot'],
  },
] as const;

const PELVIS_NAMES = ['Bip001 Pelvis', 'Bip001_Pelvis'];
const DEFAULT_REST_OFFSET = 0.1;
const REST_OFFSET_MIN = 0.04;
const REST_OFFSET_MAX = 0.2;

function findBone(map: Map<string, THREE.Object3D>, names: readonly string[]): THREE.Object3D | undefined {
  for (const n of names) {
    const b = map.get(n);
    if (b) return b;
  }
  return undefined;
}

export class FootIkRig {
  private root: THREE.Object3D;
  private pelvis: THREE.Object3D | null = null;
  private pelvisRest = new THREE.Vector3();
  private legs: Leg[] = [];
  private calibrated = false;
  private weight = 0;
  private _a = new THREE.Vector3();
  private _b = new THREE.Vector3();
  private _c = new THREE.Vector3();
  private _foot = new THREE.Vector3();
  private _target = new THREE.Vector3();
  private _axis = new THREE.Vector3();
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _pelvisWorld = new THREE.Vector3();
  private _desired = new THREE.Vector3();
  private _q = new THREE.Quaternion();
  private _bw = new THREE.Quaternion();
  private _pw = new THREE.Quaternion();

  constructor(root: THREE.Object3D) {
    this.root = root;
    const byName = new Map<string, THREE.Object3D>();
    root.traverse((n) => {
      if ((n as THREE.Bone).isBone) byName.set(n.name, n);
    });
    this.pelvis = findBone(byName, PELVIS_NAMES) ?? null;
    if (this.pelvis) this.pelvisRest.copy(this.pelvis.position);
    for (const set of LEG_SETS) {
      const thigh = findBone(byName, set.thigh);
      const calf = findBone(byName, set.calf);
      const foot = findBone(byName, set.foot);
      if (thigh && calf && foot) {
        this.legs.push({ thigh, calf, foot, restOffset: DEFAULT_REST_OFFSET });
      }
    }
  }

  get valid(): boolean {
    return this.pelvis !== null && this.legs.length === 2;
  }

  apply(raycastGround: GroundRay, active: boolean, dt: number, tune: FootIkTune = FOOT_IK): void {
    if (!this.valid) return;
    const pelvis = this.pelvis!;

    const target = active && tune.enabled ? 1 : 0;
    this.weight = dampWeight(this.weight, target, tune.weightRate, dt);
    if (this.weight < 0.001) {
      this.weight = 0;
      pelvis.position.copy(this.pelvisRest);
      return;
    }

    this.root.updateWorldMatrix(true, true);
    pelvis.position.copy(this.pelvisRest);
    pelvis.updateWorldMatrix(false, true);

    const groundYs: (number | null)[] = [];
    const deltas: number[] = [];
    for (const leg of this.legs) {
      leg.foot.getWorldPosition(this._foot);
      const gy = raycastGround(this._foot.x, this._foot.y, this._foot.z);
      groundYs.push(gy);
      if (gy === null) continue;
      if (!this.calibrated) {
        leg.restOffset = THREE.MathUtils.clamp(
          this._foot.y - gy,
          REST_OFFSET_MIN,
          REST_OFFSET_MAX,
        );
      }
      let delta = gy + leg.restOffset - this._foot.y;
      delta = THREE.MathUtils.clamp(delta, -tune.maxStep, tune.maxStep);
      deltas.push(delta);
    }
    if (deltas.length > 0) this.calibrated = true;

    const drop = pelvisDrop(deltas, tune.maxPelvisDrop) * this.weight;
    if (drop !== 0) {
      pelvis.getWorldPosition(this._pelvisWorld);
      this._desired.copy(this._pelvisWorld).y += drop;
      pelvis.parent?.worldToLocal(this._desired);
      pelvis.position.copy(this._desired);
      this.root.updateWorldMatrix(false, true);
    }

    for (let i = 0; i < this.legs.length; i++) {
      const gy = groundYs[i];
      if (gy === null) continue;
      const leg = this.legs[i];
      leg.foot.getWorldPosition(this._foot);
      const targetY = THREE.MathUtils.lerp(this._foot.y, gy + leg.restOffset, this.weight);
      this._target.set(this._foot.x, targetY, this._foot.z);
      this.solveLeg(leg, this._target);
    }
  }

  private solveLeg(leg: Leg, target: THREE.Vector3): void {
    const { thigh, calf, foot } = leg;
    thigh.getWorldPosition(this._a);
    calf.getWorldPosition(this._b);
    foot.getWorldPosition(this._c);

    const l1 = this._a.distanceTo(this._b);
    const l2 = this._b.distanceTo(this._c);
    if (l1 <= 1e-5 || l2 <= 1e-5) return;

    const curDist = this._a.distanceTo(this._c);
    const wantDist = clampReach(this._a.distanceTo(target), l1, l2, 0.02);
    const kneeNow = lawOfCosinesAngle(l1, l2, curDist);
    const kneeWant = solveTwoBoneAngles(l1, l2, wantDist).knee;

    this._axis.copy(this._a).sub(this._b);
    this._v1.copy(this._c).sub(this._b);
    this._axis.cross(this._v1);
    if (this._axis.lengthSq() < 1e-8) {
      this._v2.copy(this._c).sub(this._a).normalize();
      this._axis.set(0, 0, 1).cross(this._v2);
      if (this._axis.lengthSq() < 1e-8) this._axis.set(1, 0, 0);
    }
    this._axis.normalize();

    const bend = kneeWant - kneeNow;
    this.rotateBoneWorld(calf, this._axis, bend);
    foot.getWorldPosition(this._foot);
    const after = this._a.distanceTo(this._foot);
    if (Math.abs(after - wantDist) > Math.abs(curDist - wantDist) + 1e-4) {
      this.rotateBoneWorld(calf, this._axis, -2 * bend);
    }

    foot.getWorldPosition(this._foot);
    this._v1.copy(this._foot).sub(this._a);
    this._v2.copy(target).sub(this._a);
    if (this._v1.lengthSq() < 1e-8 || this._v2.lengthSq() < 1e-8) return;
    const ang = this._v1.angleTo(this._v2);
    if (ang < 1e-4) return;
    this._axis.copy(this._v1).cross(this._v2);
    if (this._axis.lengthSq() < 1e-8) return;
    this._axis.normalize();
    this.rotateBoneWorld(thigh, this._axis, ang);
  }

  private rotateBoneWorld(bone: THREE.Object3D, worldAxis: THREE.Vector3, angle: number): void {
    if (Math.abs(angle) < 1e-6) return;
    this._q.setFromAxisAngle(worldAxis, angle);
    bone.getWorldQuaternion(this._bw);
    this._bw.premultiply(this._q);
    if (bone.parent) {
      bone.parent.getWorldQuaternion(this._pw);
      this._pw.invert();
      bone.quaternion.copy(this._pw).multiply(this._bw);
    } else {
      bone.quaternion.copy(this._bw);
    }
    bone.updateWorldMatrix(false, true);
  }
}