/**
 * Landing Page — 3D orbiting camera with auth CTA overlay.
 */

import * as THREE from 'three';
import { isAuthenticated, loginDiscord, loginGuest } from '../lib/auth';

export function mountLanding(container: HTMLElement): () => void {
  // If already authed, skip to lobby
  if (isAuthenticated()) {
    window.location.hash = '#/lobby';
    return () => {};
  }

  // UI
  container.innerHTML = `
    <div id="landing-bg"></div>
    <div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;pointer-events:none;">
      <div style="pointer-events:auto;text-align:center;max-width:520px;padding:40px;">
        <h1 style="font-size:48px;color:#c8a84b;letter-spacing:6px;font-family:'Cinzel',serif,system-ui;margin:0;text-shadow:0 0 40px rgba(200,168,75,0.4);">GRUDGE</h1>
        <h2 style="font-size:20px;color:#8a8070;letter-spacing:8px;margin:8px 0 32px;font-weight:300;">M E T A V E R S E</h2>
        <p style="color:#a09880;font-size:14px;line-height:1.6;margin-bottom:32px;">
          Enter the world of Grudge Warlords. Choose your faction, build your crew, and conquer the islands.
        </p>
        <div style="display:flex;flex-direction:column;gap:12px;align-items:center;">
          <button id="btn-discord" style="width:280px;padding:14px;border:none;border-radius:8px;background:#5865F2;color:white;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:1px;transition:transform 0.1s;">
            ⚡ Continue with Discord
          </button>
          <button id="btn-guest" style="width:280px;padding:14px;border:1px solid rgba(200,168,75,0.3);border-radius:8px;background:rgba(200,168,75,0.1);color:#c8a84b;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:1px;transition:transform 0.1s;">
            🎮 Play as Guest
          </button>
          <p style="color:#555;font-size:11px;margin-top:8px;">By Racalvin The Pirate King · grudge-studio.com</p>
        </div>
      </div>
    </div>
  `;

  // 3D Background — slow orbit
  const bgEl = document.getElementById('landing-bg')!;
  bgEl.style.cssText = 'position:fixed;inset:0;z-index:0;';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060610);
  scene.fog = new THREE.FogExp2(0x060610, 0.015);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  bgEl.appendChild(renderer.domElement);

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const starVerts = new Float32Array(3000);
  for (let i = 0; i < 3000; i++) starVerts[i] = (Math.random() - 0.5) * 300;
  starGeo.setAttribute('position', new THREE.BufferAttribute(starVerts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaaaacc, size: 0.3 })));

  // Floating island placeholder
  const island = new THREE.Mesh(
    new THREE.DodecahedronGeometry(8, 1),
    new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.9, flatShading: true }),
  );
  island.position.y = -3;
  scene.add(island);

  // Ambient glow
  scene.add(new THREE.AmbientLight(0x303050, 0.5));
  const light = new THREE.PointLight(0xc8a84b, 2, 60);
  light.position.set(0, 10, 0);
  scene.add(light);

  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    camera.position.set(Math.sin(t * 0.1) * 25, 8 + Math.sin(t * 0.15) * 3, Math.cos(t * 0.1) * 25);
    camera.lookAt(0, 0, 0);
    island.rotation.y = t * 0.05;
    renderer.render(scene, camera);
  }
  animate();

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  // Auth buttons
  document.getElementById('btn-discord')?.addEventListener('click', loginDiscord);
  document.getElementById('btn-guest')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-guest') as HTMLButtonElement;
    btn.textContent = 'Connecting...';
    btn.disabled = true;
    const ok = await loginGuest();
    if (ok) {
      window.location.hash = '#/lobby';
    } else {
      btn.textContent = 'Failed — Try Again';
      btn.disabled = false;
    }
  });

  // Cleanup
  return () => {
    running = false;
    removeEventListener('resize', onResize);
    renderer.dispose();
    bgEl.remove();
  };
}
