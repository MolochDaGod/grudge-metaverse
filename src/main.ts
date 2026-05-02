import * as THREE from 'three';

// ── Scene ────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);
scene.fog = new THREE.FogExp2(0x0a0a1a, 0.008);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// ── Lighting ─────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
sun.position.set(50, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x8899cc, 0.3);
fill.position.set(-30, 40, -20);
scene.add(fill);

// ── Terrain (procedural island) ──────────────────────────────
const terrainSize = 200;
const terrainSeg = 128;
const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSeg, terrainSeg);
terrainGeo.rotateX(-Math.PI / 2);

// Generate heightmap
const verts = terrainGeo.attributes.position;
for (let i = 0; i < verts.count; i++) {
  const x = verts.getX(i);
  const z = verts.getZ(i);
  const dist = Math.sqrt(x * x + z * z);
  // Island shape: high center, falls off to water
  const island = Math.max(0, 1 - dist / (terrainSize * 0.45));
  const noise1 = Math.sin(x * 0.05) * Math.cos(z * 0.07) * 4;
  const noise2 = Math.sin(x * 0.12 + 1.3) * Math.cos(z * 0.09 - 0.7) * 2;
  const noise3 = Math.sin(x * 0.25 + z * 0.18) * 1;
  const h = (noise1 + noise2 + noise3) * island * island + island * 8;
  verts.setY(i, Math.max(h, -0.5));
}
terrainGeo.computeVertexNormals();

// Color terrain by height
const colors = new Float32Array(verts.count * 3);
for (let i = 0; i < verts.count; i++) {
  const h = verts.getY(i);
  let r, g, b;
  if (h < 0.2) { r = 0.6; g = 0.55; b = 0.4; }       // sand
  else if (h < 3) { r = 0.2; g = 0.45; b = 0.15; }     // grass
  else if (h < 6) { r = 0.25; g = 0.35; b = 0.12; }    // dark grass
  else { r = 0.4; g = 0.38; b = 0.35; }                 // rock
  // Add noise variation
  const v = (Math.random() - 0.5) * 0.06;
  colors[i * 3] = r + v; colors[i * 3 + 1] = g + v; colors[i * 3 + 2] = b + v;
}
terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const terrainMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.9, metalness: 0.0, flatShading: false,
});
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
scene.add(terrain);

// ── Water ────────────────────────────────────────────────────
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({
    color: 0x1a3a5c, transparent: true, opacity: 0.7, roughness: 0.2, metalness: 0.3,
  }),
);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.3;
scene.add(water);

// ── Trees ────────────────────────────────────────────────────
const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1a, roughness: 0.9 });
const leafGeo = new THREE.SphereGeometry(1.2, 6, 5);

for (let i = 0; i < 120; i++) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 10 + Math.random() * 70;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;
  const h = getHeight(x, z);
  if (h < 1 || h > 7) continue;

  const leafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.25 + Math.random() * 0.1, 0.5, 0.25 + Math.random() * 0.15),
    roughness: 0.8,
  });

  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1;
  trunk.castShadow = true;
  tree.add(trunk);

  const leaves = new THREE.Mesh(leafGeo, leafMat);
  leaves.position.y = 2.8;
  leaves.scale.setScalar(0.6 + Math.random() * 0.6);
  leaves.castShadow = true;
  tree.add(leaves);

  tree.position.set(x, h, z);
  tree.scale.setScalar(0.8 + Math.random() * 0.8);
  scene.add(tree);
}

// ── Player ───────────────────────────────────────────────────
const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 1.2, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0xc8a84b, roughness: 0.5, metalness: 0.3 }),
);
body.position.y = 1;
body.castShadow = true;
player.add(body);

// Direction indicator
const visor = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.15, 0.1),
  new THREE.MeshStandardMaterial({ color: 0x2244aa, emissive: 0x1133ff, emissiveIntensity: 0.5 }),
);
visor.position.set(0, 1.5, -0.45);
player.add(visor);

player.position.set(0, 10, 0);
scene.add(player);

// ── Input ────────────────────────────────────────────────────
const keys = new Set<string>();
let mouseDown = false;
let cameraYaw = 0;
let cameraPitch = 0.35;

addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; });
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  cameraYaw -= e.movementX * 0.003;
  cameraPitch = Math.max(0.1, Math.min(0.8, cameraPitch + e.movementY * 0.003));
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Height query ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
function getHeight(x: number, z: number): number {
  raycaster.set(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
  const hits = raycaster.intersectObject(terrain);
  return hits.length > 0 ? hits[0].point.y : 0;
}

// ── Game loop ────────────────────────────────────────────────
const velocity = new THREE.Vector3();
const moveDir = new THREE.Vector3();
const clock = new THREE.Clock();
const moveSpeed = 20;
const turnSpeed = 2.5;
let jumpVel = 0;
let grounded = true;

// Hide loading screen
setTimeout(() => document.getElementById('loading')?.classList.add('hidden'), 500);

function animate() {
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

  if (moveDir.length() > 0) moveDir.normalize();
  moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

  velocity.lerp(moveDir.multiplyScalar(moveSpeed), dt * 5);
  player.position.x += velocity.x * dt;
  player.position.z += velocity.z * dt;

  // Jump
  if (keys.has(' ') && grounded) { jumpVel = 12; grounded = false; }
  jumpVel -= 30 * dt; // gravity
  player.position.y += jumpVel * dt;

  // Terrain snap
  const h = getHeight(player.position.x, player.position.z);
  if (player.position.y <= h) {
    player.position.y = h;
    jumpVel = 0;
    grounded = true;
  }

  // Player rotation — face movement
  if (moving) {
    const target = Math.atan2(velocity.x, velocity.z);
    player.rotation.y += (target - player.rotation.y) * dt * 8;
  }

  // Camera — over-the-shoulder
  const camOffset = new THREE.Vector3(0, 8 + cameraPitch * 6, 16);
  camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
  const camTarget = player.position.clone();
  camera.position.lerp(camTarget.clone().add(camOffset), dt * 5);
  camera.lookAt(camTarget.x, camTarget.y + 2, camTarget.z);

  // Water animation
  water.material.opacity = 0.6 + Math.sin(clock.elapsedTime * 0.5) * 0.1;

  renderer.render(scene, camera);
}

animate();
