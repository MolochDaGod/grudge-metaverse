/**
 * #/game — hands off to Character-Animator-two /game/world (GameCharacter stack).
 * No duplicate vanilla Three.js animator lives here.
 */
import { launchGrudgeGameWorld } from '../lib/worldBridge';

export function mountGame(container: HTMLElement): () => void {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0f;color:#c8a84b;font-family:system-ui;gap:16px;">
      <div style="width:40px;height:40px;border:3px solid rgba(200,168,75,0.2);border-top-color:#c8a84b;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <div style="letter-spacing:2px;font-size:15px;">Opening Grudge Game World…</div>
      <div style="color:#666;font-size:12px;">GameCharacter · AnimationDirector · character-kit</div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>
  `;
  void launchGrudgeGameWorld();
  return () => {};
}