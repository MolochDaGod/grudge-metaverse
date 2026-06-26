/**
 * Lobby Page — Load Grudge Warlords characters, select, enter metaverse world.
 */

import { isAuthenticated, getUser, logout } from '../lib/auth';
import {
  createWarlordsCharacter,
  fetchWarlordsCharacters,
  getRaceConfig,
  type WarlordsCharacter,
} from '../lib/warlordsCharacter';
import { setActiveCharacter } from '../lib/characterSession';
import { buildWorldUrl } from '../lib/worldBridge';
import {
  createFreePlayCharacter,
  FREE_PLAY_CLASSES,
  FREE_PLAY_RACE_IDS,
  type FreePlayRaceId,
} from '../lib/freePlayRoster';

export function mountLobby(container: HTMLElement): () => void {
  if (!isAuthenticated()) {
    window.location.hash = '#/';
    return () => {};
  }

  const user = getUser();

  container.innerHTML = `
    <div style="min-height:100vh;background:#0a0a0f;color:#e0d6c0;font-family:'Segoe UI',system-ui,sans-serif;">
      <header style="display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid rgba(200,168,75,0.15);background:rgba(10,10,20,0.9);">
        <div>
          <span style="color:#c8a84b;font-size:18px;font-weight:700;letter-spacing:2px;">⚔ GRUDGE METAVERSE</span>
          <span style="color:#555;margin-left:12px;font-size:12px;">LOBBY</span>
        </div>
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="color:#8a8070;font-size:13px;">
            ${user?.displayName || user?.username || 'Player'}
            <span style="color:#c8a84b;margin-left:6px;">${user?.gold || 0}g</span>
          </span>
          <button id="btn-logout" style="padding:6px 14px;border:1px solid #444;border-radius:6px;background:transparent;color:#888;cursor:pointer;font-size:12px;">Logout</button>
        </div>
      </header>

      <main style="max-width:900px;margin:0 auto;padding:32px 24px;">
        <section style="margin-bottom:36px;">
          <h2 style="color:#c8a84b;font-size:22px;margin-bottom:4px;">Free Play — Grudge6</h2>
          <p style="color:#666;font-size:13px;margin-bottom:16px;">Human · Barbarian · Orc · Undead · Elf · Dwarf — opens Character-Animator-two <strong style="color:#8a8070;font-weight:600;">grudge-game /world</strong> (GameCharacter · animDirector · character-kit).</p>
          <div id="freeplay-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:12px;"></div>
          <label style="color:#8a8070;font-size:12px;display:flex;align-items:center;gap:8px;">
            Class
            <select id="freeplay-class" style="padding:6px 10px;border:1px solid #333;border-radius:6px;background:#0a0a15;color:#e0d6c0;font-size:13px;">
              ${FREE_PLAY_CLASSES.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
            </select>
          </label>
        </section>

        <h2 style="color:#c8a84b;font-size:22px;margin-bottom:4px;">Your Warlords Characters</h2>
        <p style="color:#666;font-size:13px;margin-bottom:24px;">Characters sync from Grudge Warlords — pick one to load your saved grudge6 avatar into the world.</p>

        <div id="char-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-bottom:24px;">
          <div style="padding:40px;text-align:center;color:#555;border:1px dashed rgba(200,168,75,0.2);border-radius:12px;">
            Loading characters...
          </div>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button id="btn-create" style="padding:12px 24px;border:1px solid rgba(200,168,75,0.3);border-radius:8px;background:rgba(200,168,75,0.1);color:#c8a84b;font-size:14px;font-weight:600;cursor:pointer;">
            + Create Character
          </button>
          <button id="btn-play-guest" style="padding:12px 24px;border:none;border-radius:8px;background:#2a6b2a;color:white;font-size:14px;font-weight:600;cursor:pointer;">
            ▶ Enter World (Guest Avatar)
          </button>
        </div>
      </main>

      <div id="create-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:100;align-items:center;justify-content:center;">
        <div style="background:#12121f;border:1px solid rgba(200,168,75,0.3);border-radius:12px;padding:32px;max-width:400px;width:90%;">
          <h3 style="color:#c8a84b;margin:0 0 20px;">Create Character</h3>
          <input id="char-name" placeholder="Character name" style="width:100%;padding:10px;border:1px solid #333;border-radius:6px;background:#0a0a15;color:#e0d6c0;margin-bottom:12px;font-size:14px;" />
          <select id="char-race" style="width:100%;padding:10px;border:1px solid #333;border-radius:6px;background:#0a0a15;color:#e0d6c0;margin-bottom:12px;">
            <option value="human">Human</option><option value="barbarian">Barbarian</option>
            <option value="orc">Orc</option><option value="undead">Undead</option>
            <option value="elf">Elf</option><option value="dwarf">Dwarf</option>
          </select>
          <select id="char-class" style="width:100%;padding:10px;border:1px solid #333;border-radius:6px;background:#0a0a15;color:#e0d6c0;margin-bottom:20px;">
            <option value="warrior">Warrior</option><option value="mage">Mage</option>
            <option value="ranger">Ranger</option><option value="worg">Worge</option>
          </select>
          <div style="display:flex;gap:10px;">
            <button id="btn-confirm-create" style="flex:1;padding:10px;border:none;border-radius:6px;background:#c8a84b;color:#0a0a0f;font-weight:700;cursor:pointer;">Create</button>
            <button id="btn-cancel-create" style="flex:1;padding:10px;border:1px solid #333;border-radius:6px;background:transparent;color:#888;cursor:pointer;">Cancel</button>
          </div>
          <p id="create-error" style="color:#ff4444;font-size:12px;margin-top:10px;display:none;"></p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('btn-play-guest')?.addEventListener('click', () => {
    const classId = (document.getElementById('freeplay-class') as HTMLSelectElement)?.value || 'warrior';
    enterWorld(createFreePlayCharacter('human', classId));
  });

  const freeGrid = document.getElementById('freeplay-grid')!;
  const classSelect = document.getElementById('freeplay-class') as HTMLSelectElement;
  const FACTION_COLOR: Record<string, string> = {
    crusade: '#c9a227',
    fabled: '#2ecc71',
    legion: '#9b59b6',
    wild: '#e67e22',
  };

  freeGrid.innerHTML = FREE_PLAY_RACE_IDS.map((raceId) => {
    const race = getRaceConfig(raceId);
    const color = FACTION_COLOR[race.faction] ?? '#c8a84b';
    return `
      <button class="btn-freeplay" data-race="${raceId}" style="padding:14px 10px;border:1px solid rgba(200,168,75,0.25);border-radius:10px;background:rgba(20,20,35,0.9);color:#e0d6c0;cursor:pointer;text-align:left;">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};margin-bottom:8px;"></div>
        <div style="font-weight:700;font-size:14px;color:#c8a84b;">${race.label}</div>
        <div style="font-size:11px;color:#666;margin-top:2px;">${race.faction}</div>
      </button>`;
  }).join('');

  freeGrid.querySelectorAll('.btn-freeplay').forEach((btn) => {
    btn.addEventListener('click', () => {
      const raceId = (btn as HTMLElement).getAttribute('data-race') as FreePlayRaceId;
      const classId = classSelect?.value || 'warrior';
      enterWorld(createFreePlayCharacter(raceId, classId));
    });
  });

  const modal = document.getElementById('create-modal')!;
  document.getElementById('btn-create')?.addEventListener('click', () => { modal.style.display = 'flex'; });
  document.getElementById('btn-cancel-create')?.addEventListener('click', () => { modal.style.display = 'none'; });

  document.getElementById('btn-confirm-create')?.addEventListener('click', async () => {
    const name = (document.getElementById('char-name') as HTMLInputElement).value.trim();
    const raceId = (document.getElementById('char-race') as HTMLSelectElement).value;
    const classId = (document.getElementById('char-class') as HTMLSelectElement).value;
    const errEl = document.getElementById('create-error')!;

    if (!name) { errEl.textContent = 'Name required'; errEl.style.display = 'block'; return; }

    try {
      await createWarlordsCharacter({ name, raceId, classId });
      modal.style.display = 'none';
      errEl.style.display = 'none';
      loadCharacters();
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : 'Failed';
      errEl.style.display = 'block';
    }
  });

  function enterWorld(char: WarlordsCharacter) {
    setActiveCharacter(char);
    window.location.assign(buildWorldUrl(char));
  }

  async function loadCharacters() {
    const listEl = document.getElementById('char-list')!;
    try {
      const chars = await fetchWarlordsCharacters();

      if (chars.length === 0) {
        listEl.innerHTML = `<div style="padding:40px;text-align:center;color:#555;border:1px dashed rgba(200,168,75,0.2);border-radius:12px;grid-column:1/-1;">No Warlords characters yet. Create one here or on <a href="https://grudgewarlords.com/character" style="color:#c8a84b;">grudgewarlords.com</a>.</div>`;
        return;
      }

      listEl.innerHTML = chars.map((c) => {
        const race = getRaceConfig(c.raceId);
        return `
        <div class="char-card" style="padding:20px;border:1px solid rgba(200,168,75,0.2);border-radius:12px;background:rgba(20,20,35,0.8);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="color:#c8a84b;font-weight:700;font-size:16px;">${c.name}</span>
            <span style="color:#666;font-size:12px;">Lv ${c.level ?? 1}</span>
          </div>
          <div style="color:#8a8070;font-size:13px;">${race.label} · ${c.classId}</div>
          <div style="color:#555;font-size:12px;margin-top:4px;">${race.faction} · ${c.hp ?? 100} HP</div>
          <button class="btn-enter" data-id="${c.id}" style="margin-top:12px;width:100%;padding:8px;border:none;border-radius:6px;background:#2a6b2a;color:white;font-weight:600;cursor:pointer;font-size:13px;">
            ▶ Load Into World
          </button>
        </div>`;
      }).join('');

      listEl.querySelectorAll('.btn-enter').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
          const char = chars.find((c) => c.id === id);
          if (char) enterWorld(char);
        });
      });
    } catch {
      const isGuest = user?.isGuest;
      listEl.innerHTML = `<div style="padding:40px;text-align:center;color:${isGuest ? '#8a8070' : '#ff6644'};border:1px solid rgba(${isGuest ? '200,168,75,0.2' : '255,100,50,0.2'});border-radius:12px;grid-column:1/-1;">
        ${isGuest
          ? 'Guest mode — enter the world directly! Sign in with Grudge ID to load your Warlords characters.'
          : 'Could not load Warlords characters. Sign in with Grudge ID and ensure api.grudge-studio.com is reachable.'
        }
      </div>`;
    }
  }

  loadCharacters();
  return () => {};
}