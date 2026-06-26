/**
 * #/test — GrudgeBuilder Island3DEngine on Pirate Islands (Chicken Gun lobby GLTF).
 * Full Grudge Three.js engine; no duplicate metaverse animator here.
 */
import { launchPirateTestScene } from '../lib/engineBridge';

export function mountTest(container: HTMLElement): () => void {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0f;color:#c8a84b;font-family:system-ui;gap:16px;">
      <div style="width:40px;height:40px;border:3px solid rgba(200,168,75,0.2);border-top-color:#c8a84b;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <div style="letter-spacing:2px;font-size:15px;">Loading Pirate Islands…</div>
      <div style="color:#666;font-size:12px;max-width:22rem;text-align:center;line-height:1.5;">
        Island3DEngine · Chicken Gun pirate map · <code style="color:#8a8070;">pirate-islands</code> lobby GLTF
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>
  `;
  void launchPirateTestScene();
  return () => {};
}