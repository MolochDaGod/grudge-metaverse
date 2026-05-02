/**
 * Lobby Page — Character select, create character, enter world.
 */

import { isAuthenticated, getUser, authHeaders, logout, API_URL } from '../lib/auth';

interface Character {
  id: number;
  name: string;
  race: string;
  class: string;
  level: number;
  faction: string;
  hp: number;
}

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
        <h2 style="color:#c8a84b;font-size:22px;margin-bottom:4px;">Select Your Character</h2>
        <p style="color:#666;font-size:13px;margin-bottom:24px;">Choose a character to enter the world, or create a new one.</p>

        <div id="char-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-bottom:24px;">
          <div style="padding:40px;text-align:center;color:#555;border:1px dashed rgba(200,168,75,0.2);border-radius:12px;">
            Loading characters...
          </div>
        </div>

        <div style="display:flex;gap:12px;">
          <button id="btn-create" style="padding:12px 24px;border:1px solid rgba(200,168,75,0.3);border-radius:8px;background:rgba(200,168,75,0.1);color:#c8a84b;font-size:14px;font-weight:600;cursor:pointer;">
            + Create Character
          </button>
          <button id="btn-play-guest" style="padding:12px 24px;border:none;border-radius:8px;background:#2a6b2a;color:white;font-size:14px;font-weight:600;cursor:pointer;">
            ▶ Enter World (No Character)
          </button>
        </div>
      </main>

      <!-- Create Character Modal -->
      <div id="create-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:100;display:none;align-items:center;justify-content:center;">
        <div style="background:#12121f;border:1px solid rgba(200,168,75,0.3);border-radius:12px;padding:32px;max-width:400px;width:90%;">
          <h3 style="color:#c8a84b;margin:0 0 20px;">Create Character</h3>
          <input id="char-name" placeholder="Character name" style="width:100%;padding:10px;border:1px solid #333;border-radius:6px;background:#0a0a15;color:#e0d6c0;margin-bottom:12px;font-size:14px;" />
          <select id="char-race" style="width:100%;padding:10px;border:1px solid #333;border-radius:6px;background:#0a0a15;color:#e0d6c0;margin-bottom:12px;">
            <option value="human">Human</option><option value="barbarian">Barbarian</option>
            <option value="elf">Elf</option><option value="dwarf">Dwarf</option>
            <option value="orc">Orc</option><option value="undead">Undead</option>
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
    window.location.hash = '#/play';
  });

  // Character modal
  const modal = document.getElementById('create-modal')!;
  document.getElementById('btn-create')?.addEventListener('click', () => { modal.style.display = 'flex'; });
  document.getElementById('btn-cancel-create')?.addEventListener('click', () => { modal.style.display = 'none'; });

  document.getElementById('btn-confirm-create')?.addEventListener('click', async () => {
    const name = (document.getElementById('char-name') as HTMLInputElement).value.trim();
    const race = (document.getElementById('char-race') as HTMLSelectElement).value;
    const cls = (document.getElementById('char-class') as HTMLSelectElement).value;
    const errEl = document.getElementById('create-error')!;

    if (!name) { errEl.textContent = 'Name required'; errEl.style.display = 'block'; return; }

    try {
      const res = await fetch(`${API_URL}/characters`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, raceId: race, classId: cls }),
      });
      const data = await res.json();
      if (!res.ok) { errEl.textContent = data.error || 'Failed'; errEl.style.display = 'block'; return; }
      modal.style.display = 'none';
      loadCharacters();
    } catch {
      errEl.textContent = 'Network error'; errEl.style.display = 'block';
    }
  });

  // Load characters
  async function loadCharacters() {
    const listEl = document.getElementById('char-list')!;
    try {
      const res = await fetch(`${API_URL}/characters`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const chars: Character[] = data.characters || data || [];

      if (chars.length === 0) {
        listEl.innerHTML = `<div style="padding:40px;text-align:center;color:#555;border:1px dashed rgba(200,168,75,0.2);border-radius:12px;grid-column:1/-1;">No characters yet. Create one to begin!</div>`;
        return;
      }

      listEl.innerHTML = chars.map(c => `
        <div class="char-card" data-id="${c.id}" style="padding:20px;border:1px solid rgba(200,168,75,0.2);border-radius:12px;background:rgba(20,20,35,0.8);cursor:pointer;transition:border-color 0.2s;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="color:#c8a84b;font-weight:700;font-size:16px;">${c.name}</span>
            <span style="color:#666;font-size:12px;">Lv ${c.level}</span>
          </div>
          <div style="color:#8a8070;font-size:13px;">${c.race} ${c.class}</div>
          <div style="color:#555;font-size:12px;margin-top:4px;">${c.faction || 'No faction'} · ${c.hp} HP</div>
          <button class="btn-enter" data-id="${c.id}" style="margin-top:12px;width:100%;padding:8px;border:none;border-radius:6px;background:#2a6b2a;color:white;font-weight:600;cursor:pointer;font-size:13px;">
            ▶ Enter World
          </button>
        </div>
      `).join('');

      listEl.querySelectorAll('.btn-enter').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const charId = (e.target as HTMLElement).getAttribute('data-id');
          window.location.hash = `#/play?char=${charId}`;
        });
      });
    } catch {
      listEl.innerHTML = `<div style="padding:40px;text-align:center;color:#ff6644;border:1px solid rgba(255,100,50,0.2);border-radius:12px;grid-column:1/-1;">Could not connect to game server. Characters will be available when api.grudge-studio.com is online.</div>`;
    }
  }

  loadCharacters();

  return () => {};
}
