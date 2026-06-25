/**
 * Play Page — 3D game world with baked GLB map, WASD movement, multiplayer.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getUser, isAuthenticated } from '../lib/auth';
import { connect, broadcastPosition, updateRemotePlayers, disconnect } from '../lib/multiplayer';
import { createFallbackAvatar, loadWarlordsAvatar } from '../lib/avatarLoader';
import type { AvatarAnimator } from '../lib/avatarAnimator';
import { CharacterController } from '../lib/characterController';
import {
  getActiveCharacter,
  getCharacterIdFromHash,
} from '../lib/characterSession';
import { fetchWarlordsCharacter } from '../lib/warlordsCharacter';
import { isFreePlayCharacter, resolveFreePlayFromId } from '../lib/freePlayRoster';

export function mountPlay(container: HTMLElement): () => void {
  if (!isAuthenticated()) {
    window.location.hash = '#/lobby';
    return () => {};
  }

  const user = getUser();
  const activeChar = getActiveCharacter();
  const displayName = activeChar?.name || user?.displayName || 'Player';
  container.innerHTML = `
    <div id="play-canvas"></div>
    <div id="play-hud" style="position:fixed;top:0;left:0;width:100%;pointer-events:none;z-index:10;padding:12px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="pointer-events:auto;background:rgba(10,10,20,0.85);border:1px solid rgba(200,168,75,0.3);border-radius:8px;padding:10px 14px;backdrop-filter:blur(8px);">
        <div style="color:#c8a84b;font-size:14px;font-weight:700;letter-spacing:1px;">⚔ GRUDGE METAVERSE</div>
        <div style="color:#666;font-size:11px;">${displayName}${activeChar ? ` · ${activeChar.raceId} ${activeChar.classId}` : ''} · ${user?.gold || 0}g</div>
      </div>
      <div style="pointer-events:auto;background:rgba(10,10,20,0.85);border:1px solid rgba(200,168,75,0.3);border-radius:8px;padding:10px 14px;backdrop-filter:blur(8px);color:#8a8070;font-size:12px;line-height:1.6;">
        <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">W</kbd>
        <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">A</kbd>
        <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">S</kbd>
        <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">D</kbd>
        Move · <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">Shift</kbd> Sprint · <kbd style="background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.3);border-radius:3px;padding:1px 5px;color:#c8a84b;font-family:monospace;">Space</kbd> Jump · LMB look
        <br><button id="btn-back" style="margin-top:6px;pointer-events:auto;padding:4px 10px;border:1px solid #444;border-radius:4px;background:transparent;color:#888;cursor:pointer;font-size:11px;">← Back to Lobby</button>
      </div>
    </div>
    <div id="play-loading" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0f;z-index:100;color:#c8a84b;font-family:system-ui;">
      <div style="width:40px;height:40px;border:3px solid rgba(200,168,75,0.2);border-top-color:#c8a84b;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px;"></div>
      <div style="font-size:16px;letter-spacing:2px;">Loading World...</div>
      <div id="load-status" style="color:#8a8070;font-size:12px;margin-top:8px;">Preparing avatar...</div>
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

  // Stable player root — avatar mesh swaps inside; controller always targets this group
  const playerRoot = new THREE.Group();
  playerRoot.position.set(0, 5, 0);
  scene.add(playerRoot);

  let fallback = createFallbackAvatar(displayName);
  let activePlayer: THREE.Group = fallback.group;
  let avatarAnimator: AvatarAnimator | null = fallback.animator;
  playerRoot.add(activePlayer);

  const setLoadStatus = (msg: string) => {
    const el = document.getElementById('load-status');
    if (el) el.textContent = msg;
  };

  (async () => {
    try {
      let char = getActiveCharacter();
      const charId = getCharacterIdFromHash();
      if (charId && (!char || char.id !== charId)) {
        const freePlay = resolveFreePlayFromId(charId);
        if (freePlay) {
          char = freePlay;
        } else {
          setLoadStatus('Fetching Warlords character...');
          char = await fetchWarlordsCharacter(charId);
        }
      }
      if (char && isFreePlayCharacter(char)) {
        setLoadStatus(`Loading ${char.name} (free play)...`);
      }
      if (char) {
        setLoadStatus(`Loading ${char.name} (${char.raceId} GLTF)...`);
        const loaded = await loadWarlordsAvatar(char);
        const src = loaded.group.userData.avatarSource as string | undefined;
        if (src) setLoadStatus(`${char.name} ready (${src})`);
        avatarAnimator?.dispose();
        playerRoot.remove(activePlayer);
        activePlayer = loaded.group;
        avatarAnimator = loaded.animator;
        playerRoot.add(activePlayer);
      }
    } catch (err) {
      console.warn('[metaverse] Avatar load failed, using fallback:', err);
      setLoadStatus('Using guest avatar');
    }
  })();

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
      playerRoot.position.set(center.x, box.max.y + 5, center.z);

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

  const controller = new CharacterController(playerRoot);
  controller.bind();

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') window.location.hash = '#/lobby';
  };
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };

  addEventListener('keydown', onKeyDown);
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
  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    controller.update(dt, getHeight, avatarAnimator);

    const camTarget = playerRoot.position.clone();
    const camOffset = controller.getCameraOffset();
    camera.position.lerp(camTarget.clone().add(camOffset), dt * 4);
    camera.lookAt(camTarget.x, camTarget.y + 2, camTarget.z);

    // Sun follows player for shadow quality
    sun.position.set(playerRoot.position.x + 80, 120, playerRoot.position.z + 50);
    sun.target.position.copy(playerRoot.position);

    // Ocean animation
    ocean.material.opacity = 0.8 + Math.sin(clock.elapsedTime * 0.3) * 0.05;

    // Multiplayer broadcast (10 Hz)
    broadcastTimer += dt;
    if (broadcastTimer > 0.1) {
      broadcastPosition(playerRoot.position, playerRoot.rotation.y);
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
    controller.unbind();
    removeEventListener('keydown', onKeyDown);
    removeEventListener('resize', onResize);
    avatarAnimator?.dispose();
    renderer.dispose();
    canvasEl.remove();
  };
}
