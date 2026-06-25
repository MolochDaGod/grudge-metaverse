/**
 * Third-person character controller — camera-relative WASD, terrain snap, sprint.
 * Matches Grudge Warlords island controls: W/S move, A/D turn, Q/E strafe.
 */
import * as THREE from 'three';
import type { AvatarAnimator } from './avatarAnimator';

export interface CharacterControllerConfig {
  moveSpeed?: number;
  sprintMult?: number;
  turnSpeed?: number;
  jumpForce?: number;
  gravity?: number;
  groundEpsilon?: number;
}

export class CharacterController {
  readonly object: THREE.Group;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private keys = new Set<string>();
  private mouseDown = false;
  private mouseDelta = { x: 0, y: 0 };

  cameraYaw = 0;
  cameraPitch = 0.3;

  private moveSpeed: number;
  private sprintMult: number;
  private turnSpeed: number;
  private jumpForce: number;
  private gravity: number;
  private groundEpsilon: number;

  jumpVel = 0;
  grounded = true;
  private wasMoving = false;

  constructor(
    object: THREE.Group,
    config: CharacterControllerConfig = {},
  ) {
    this.object = object;
    this.moveSpeed = config.moveSpeed ?? 25;
    this.sprintMult = config.sprintMult ?? 1.8;
    this.turnSpeed = config.turnSpeed ?? 2.5;
    this.jumpForce = config.jumpForce ?? 14;
    this.gravity = config.gravity ?? 35;
    this.groundEpsilon = config.groundEpsilon ?? 0.08;
  }

  bind(): void {
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('mousedown', this.onMouseDown);
    addEventListener('mouseup', this.onMouseUp);
    addEventListener('mousemove', this.onMouseMove);
  }

  unbind(): void {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('mousedown', this.onMouseDown);
    removeEventListener('mouseup', this.onMouseUp);
    removeEventListener('mousemove', this.onMouseMove);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = true;
  };

  private onMouseUp = () => {
    this.mouseDown = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.mouseDown) return;
    this.mouseDelta.x += e.movementX;
    this.mouseDelta.y += e.movementY;
  };

  update(
    dt: number,
    getGroundHeight: (x: number, z: number) => number,
    animator: AvatarAnimator | null,
  ): void {
    if (this.mouseDown) {
      this.cameraYaw -= this.mouseDelta.x * 0.003;
      this.cameraPitch = Math.max(0.05, Math.min(0.85, this.cameraPitch + this.mouseDelta.y * 0.003));
      this.mouseDelta.x = 0;
      this.mouseDelta.y = 0;
    }

    this.direction.set(0, 0, 0);
    let moving = false;

    if (this.keys.has('w')) { this.direction.z -= 1; moving = true; }
    if (this.keys.has('s')) { this.direction.z += 1; moving = true; }
    if (this.keys.has('q')) { this.direction.x -= 1; moving = true; }
    if (this.keys.has('e')) { this.direction.x += 1; moving = true; }
    if (this.keys.has('a')) { this.cameraYaw += this.turnSpeed * dt; }
    if (this.keys.has('d')) { this.cameraYaw -= this.turnSpeed * dt; }

    const sprinting = this.keys.has('shift');
    const speed = sprinting ? this.moveSpeed * this.sprintMult : this.moveSpeed;

    if (this.direction.lengthSq() > 0) this.direction.normalize();

    const moveDir = this.direction.clone();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);

    this.velocity.lerp(moveDir.multiplyScalar(speed), dt * 5);
    this.object.position.x += this.velocity.x * dt;
    this.object.position.z += this.velocity.z * dt;

    if (this.keys.has(' ') && this.grounded) {
      this.jumpVel = this.jumpForce;
      this.grounded = false;
      this.keys.delete(' ');
    }

    this.jumpVel -= this.gravity * dt;
    this.object.position.y += this.jumpVel * dt;

    const groundY = getGroundHeight(this.object.position.x, this.object.position.z);
    if (this.object.position.y <= groundY + this.groundEpsilon) {
      this.object.position.y = groundY;
      this.jumpVel = 0;
      this.grounded = true;
    }

    if (moving && this.velocity.lengthSq() > 0.01) {
      const target = Math.atan2(this.velocity.x, this.velocity.z);
      this.object.rotation.y = THREE.MathUtils.lerp(
        this.object.rotation.y,
        target,
        Math.min(1, dt * 8),
      );
    }

    animator?.setLocomotion(moving ? 'walk' : 'idle', sprinting);
    animator?.update(dt);

    this.wasMoving = moving;
  }

  getCameraOffset(): THREE.Vector3 {
    const camDist = 12;
    const camHeight = 6 + this.cameraPitch * 8;
    const offset = new THREE.Vector3(0, camHeight, camDist);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);
    return offset;
  }

  isMoving(): boolean {
    return this.wasMoving;
  }
}