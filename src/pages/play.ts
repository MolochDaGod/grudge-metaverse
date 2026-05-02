/**
 * Play Page — 3D game world with baked GLB map, WASD movement, multiplayer.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getUser, isAuthenticated } from '../lib/auth';
import { connect, broadcastPosition, updateRemotePlayers, disconnect } from '../lib/multiplayer';

export function mountPlay(container: HTMLElement): () => void {
  if (!isAuthenticated()) {
    window.location.hash = '#/lobby';
    return () => {};
  }

  const user = getUser();
  container.innerHTML = `
    <div id="play-canvas"></div>
    <div id="play-hud" style="position:fixed;top:0;left:0;width:100%;pointer-events:none;z-index:10;padding:12px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="pointer-events:auto;background:rgba(10,10,20,0.85);border:1px solid rgba(200,168,75,0.3);border-radius:8px;padding:10px 14px;backdrop-filter:blur(8px);">
        <div style="color:#c8a84b;font-size:14px;font-weight:700;letter-spacing:1px;">⚔ GRUDGE METAVERSE</div>
        <div style="color:#666;font-size:11px;">${user?.displayName || 'Player'} · ${user?.gold || 0}g</div>
      </div>
      <div style="pointer-events:auto;background:rgba(10,10,20,0.85);border:1px solid rgba(200,168,75,0.3);border-radius:8px;padding:10px 14px;backdrop-filter:blur(8px);color:#8a8070;font-size:12px;line-height:1.6;">
        <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">W</kbd>
        <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">A</kbd>
        <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">S</kbd>
        <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">D</kbd>
        Move · <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">Space</kbd> Jump · LMB Drag to look
        <br><button id="btn-back" style="margin-top:6px;pointer-events:auto;padding:4px 10px;border:1px solid #444;border-radius:4px;background:transparent;color:#888;cursor:pointer;font-size:11px;">← Back to Lobby</button>
      </div>
    </div>
    <div id="play-loading" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0f;z-index:100;color:#c8a84b;font-family:system-ui;">
      <div style="width:40px;height:40px;border:3px solid rgba(200,168,75,0.2);border-top-color:#c8a84b;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px;"></div>
      <div style="font-size:16px;letter-spacing:2px;">Loading World...</div>
      <div id="load-progress" style="color:#555;font-size:12px;margin-top:8px;">0%</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;

  const canvasEl = document.getElementById('play-canvas')!;
  canvasEl.style.cssText = 'position:fixed;inset:0;z-index:0;';

  document.getElementById('btn-back')?.addEventListener('click', () => {
    window.location.hash = '#/lobby';
  });

  // ── Three.js Setup ──────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue
  scene.fog = new THREE.Fog(0x87ceeb, 100, 600);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  canvasEl.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0x6688aa, 0.8));
  const sun = new THREE.DirectionalLight(0xffeedd, 1.6);
  sun.position.set(80, 120, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  const sc = 120;
  sun.shadow.camera.left = -sc; sun.shadow.camera.right = sc;
  sun.shadow.camera.top = sc; sun.shadow.camera.bottom = -sc;
  scene.add(sun);
  scene.add(new THREE.DirectionalLight(0x8899cc, 0.4).translateX(-40).translateY(60).translateZ(-30));
  scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5c3a, 0.5));

  // Ocean
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0x1a5a8c, transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.4 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -1;
  scene.add(ocean);

  // Player
  const player = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.4, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xc8a84b, roughness: 0.5, metalness: 0.3 }),
  );
  body.position.y = 1.2;
  body.castShadow = true;
  player.add(body);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.18, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x2244aa, emissive: 0x1133ff, emissiveIntensity: 0.5 }),
  );
  visor.position.set(0, 1.7, -0.5);
  player.add(visor);
  player.position.set(0, 5, 0);
  scene.add(player);

  // ── Load Baked Map ──────────────────────────────────────────
  const loader = new GLTFLoader();
  let worldMeshes: THREE.Mesh[] = [];

  loader.load(
    '/maps/pirate-world.glb',
    (gltf) => {
      const world = gltf.scene;
      world.scale.setScalar(3); // Scale up for GTA feel
      world.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          worldMeshes.push(child as THREE.Mesh);
        }
      });
      scene.add(world);

      // Find spawn point (center of the map's bounding box)
      const box = new THREE.Box3().setFromObject(world);
      const center = box.getCenter(new THREE.Vector3());
      player.position.set(center.x, box.max.y + 5, center.z);

      // Hide loading
      document.getElementById('play-loading')?.classList.add('hidden');
      setTimeout(() => document.getElementById('play-loading')?.remove(), 500);
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        const el = document.getElementById('load-progress');
        if (el) el.textContent = `${pct}%`;
      }
    },
    (err) => {
      console.error('Map load failed:', err);
      const el = document.getElementById('load-progress');
      if (el) el.textContent = 'Map load failed — using flat terrain';
      // Fallback: flat terrain
      const fallback = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.MeshStandardMaterial({ color: 0x3a6b3a, roughness: 0.9 }),
      );
      fallback.rotation.x = -Math.PI / 2;
      fallback.receiveShadow = true;
      worldMeshes.push(fallback);
      scene.add(fallback);
      setTimeout(() => document.getElementById('play-loading')?.remove(), 1000);
    },
  );

  // ── Input ──────────────────────────────────────────────────
  const keys = new Set<string>();
  let mouseDown = false;
  let cameraYaw = 0;
  let cameraPitch = 0.3;

  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.key.toLowerCase());
    if (e.key === 'Escape') window.location.hash = '#/lobby';
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  const onMouseDown = (e: MouseEvent) => { if (e.button === 0) mouseDown = true; };
  const onMouseUp = () => { mouseDown = false; };
  const onMouseMove = (e: MouseEvent) => {
    if (!mouseDown) return;
    cameraYaw -= e.movementX * 0.003;
    cameraPitch = Math.max(0.05, Math.min(0.85, cameraPitch + e.movementY * 0.003));
  };
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };

  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('mousedown', onMouseDown);
  addEventListener('mouseup', onMouseUp);
  addEventListener('mousemove', onMouseMove);
  addEventListener('resize', onResize);

  // ── Terrain Height Raycast ─────────────────────────────────
  const raycaster = new THREE.Raycaster();
  function getHeight(x: number, z: number): number {
    raycaster.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
    if (worldMeshes.length === 0) return 0;
    const hits = raycaster.intersectObjects(worldMeshes, false);
    return hits.length > 0 ? hits[0].point.y : -1;
  }

  // ── Multiplayer ────────────────────────────────────────────
  connect(scene, 'island_1');
  let broadcastTimer = 0;

  // ── Game Loop ──────────────────────────────────────────────
  const velocity = new THREE.Vector3();
  const moveDir = new THREE.Vector3();
  const clock = new THREE.Clock();
  const moveSpeed = 25;
  const turnSpeed = 2.5;
  let jumpVel = 0;
  let grounded = true;
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    // Movement
    moveDir.set(0, 0, 0);
    let moving = false;
    if (keys.has('w')) { moveDir.z -= 1; moving = true; }
    if (keys.has('s')) { moveDir.z += 1; moving = true; }
    if (keys.has('a')) { cameraYaw += turnSpeed * dt; }
    if (keys.has('d')) { cameraYaw -= turnSpeed * dt; }
    if (keys.has('q')) { moveDir.x -= 1; moving = true; }
    if (keys.has('e')) { moveDir.x += 1; moving = true; }

    // Sprint
    const speed = keys.has('shift') ? moveSpeed * 1.8 : moveSpeed;

    if (moveDir.length() > 0) moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

    velocity.lerp(moveDir.multiplyScalar(speed), dt * 5);
    player.position.x += velocity.x * dt;
    player.position.z += velocity.z * dt;

    // Jump
    if (keys.has(' ') && grounded) { jumpVel = 14; grounded = false; }
    jumpVel -= 35 * dt;
    player.position.y += jumpVel * dt;

    // Terrain snap
    const h = getHeight(player.position.x, player.position.z);
    if (player.position.y <= h + 0.1) {
      player.position.y = h;
      jumpVel = 0;
      grounded = true;
    }

    // Player rotation
    if (moving) {
      const target = Math.atan2(velocity.x, velocity.z);
      player.rotation.y += (target - player.rotation.y) * dt * 8;
    }

    // Camera — GTA over-the-shoulder
    const camDist = 12;
    const camHeight = 6 + cameraPitch * 8;
    const camOffset = new THREE.Vector3(0, camHeight, camDist);
    camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
    const camTarget = player.position.clone();
    camera.position.lerp(camTarget.clone().add(camOffset), dt * 4);
    camera.lookAt(camTarget.x, camTarget.y + 2, camTarget.z);

    // Sun follows player for shadow quality
    sun.position.set(player.position.x + 80, 120, player.position.z + 50);
    sun.target.position.copy(player.position);

    // Ocean animation
    ocean.material.opacity = 0.8 + Math.sin(clock.elapsedTime * 0.3) * 0.05;

    // Multiplayer broadcast (10 Hz)
    broadcastTimer += dt;
    if (broadcastTimer > 0.1) {
      broadcastPosition(player.position, player.rotation.y);
      broadcastTimer = 0;
    }
    updateRemotePlayers(dt);

    renderer.render(scene, camera);
  }
  animate();

  // Cleanup
  return () => {
    running = false;
    disconnect();
    removeEventListener('keydown', onKeyDown);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('mousedown', onMouseDown);
    removeEventListener('mouseup', onMouseUp);
    removeEventListener('mousemove', onMouseMove);
    removeEventListener('resize', onResize);
    renderer.dispose();
    canvasEl.remove();
  };
}
