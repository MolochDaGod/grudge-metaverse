/**
 * Auth — Grudge Studio authentication for the Metaverse client.
 *
 * PRIMARY: Puter SDK → puter.auth.signIn() → POST /auth/puter → Grudge JWT + server wallet
 * FALLBACK: Guest login via deviceId → POST /auth/guest → limited Grudge JWT
 * SECONDARY: Discord/Google/GitHub OAuth (available but not the default CTA)
 *
 * Every authenticated user gets:
 *   - A Grudge ID (UUID)
 *   - A server-side Solana wallet (HD-derived from master seed)
 *   - A Puter cloud account (for KV/FS storage, earns PIP revenue for Grudge Studio)
 */

const AUTH_URL = 'https://id.grudge-studio.com';
const API_URL = 'https://api.grudge-studio.com';
const TOKEN_KEY = 'grudge_auth_token';
const USER_KEY = 'grudge_user';

export interface GrudgeUser {
  grudgeId: string;
  username: string;
  displayName: string;
  role: string;
  faction: string | null;
  race: string | null;
  class: string | null;
  walletAddress: string | null;
  serverWalletAddress: string | null;
  gold: number;
  gbuxBalance: number;
  isGuest: boolean;
  puterUuid: string | null;
}

// ── Token / user storage ─────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getUser(): GrudgeUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(token: string, user: GrudgeUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.hash = '#/';
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

// ── Parse auth response from any grudge-id endpoint ──────────

function parseAuthResponse(data: any): { token: string; user: GrudgeUser } | null {
  const token = data.token;
  if (!token) return null;

  const u = data.user || data;
  return {
    token,
    user: {
      grudgeId: u.grudgeId || data.grudgeId || data.grudge_id,
      username: u.username || data.username,
      displayName: u.displayName || u.username || data.username,
      role: u.role || 'pleb',
      faction: u.faction || null,
      race: u.race || null,
      class: u.class || null,
      walletAddress: u.walletAddress || null,
      serverWalletAddress: u.serverWalletAddress || null,
      gold: u.gold ?? 1000,
      gbuxBalance: u.gbuxBalance ?? 0,
      isGuest: !!u.isGuest,
      puterUuid: u.puterUuid || null,
    },
  };
}

// ── Handle OAuth callback tokens in URL ──────────────────────

export async function handleAuthCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || params.get('sso_token');
  if (!token) return false;

  window.history.replaceState({}, '', window.location.pathname + window.location.hash);

  try {
    const res = await fetch(`${AUTH_URL}/auth/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAuth(token, {
      grudgeId: data.grudgeId,
      username: data.username,
      displayName: data.displayName || data.username,
      role: data.role || 'pleb',
      faction: data.faction,
      race: data.race,
      class: data.class,
      walletAddress: data.walletAddress,
      serverWalletAddress: data.serverWalletAddress,
      gold: data.gold || 0,
      gbuxBalance: data.gbuxBalance || 0,
      isGuest: data.isGuest || false,
      puterUuid: data.puterUuid || null,
    });
    return true;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// PRIMARY: Puter SDK auth
// ══════════════════════════════════════════════════════════════
// Loads puter.js, calls puter.auth.signIn(), sends UUID to grudge-id.
// Every puter account auto-creates a Grudge ID + server-side Solana wallet.
// Players' puter.ai + puter.kv + puter.fs usage generates PIP revenue.

export async function loginWithPuter(): Promise<boolean> {
  try {
    // Load Puter SDK if not already loaded
    if (!(window as any).puter) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.puter.com/v2/';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Puter SDK'));
        document.head.appendChild(script);
      });
    }

    const puter = (window as any).puter;
    if (!puter) throw new Error('Puter SDK not available');

    // Sign in via Puter (shows Puter auth popup if needed)
    const puterUser = await puter.auth.signIn();
    if (!puterUser?.uuid) throw new Error('Puter auth failed — no UUID');

    // Exchange Puter UUID for Grudge JWT + server wallet
    const res = await fetch(`${AUTH_URL}/auth/puter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        puterUuid: puterUser.uuid,
        puterUsername: puterUser.username || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Auth failed');

    const parsed = parseAuthResponse(data);
    if (!parsed) throw new Error('Invalid auth response');

    setAuth(parsed.token, { ...parsed.user, puterUuid: puterUser.uuid });
    return true;
  } catch (err) {
    console.warn('[auth] Puter login failed:', err);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// GUEST: Device-based guest login
// ══════════════════════════════════════════════════════════════
// Creates a lightweight guest account with 500g starting gold.
// No server wallet created for guests.
// Guest can later upgrade by linking Puter, Discord, or setting a password.

export async function loginGuest(): Promise<boolean> {
  try {
    const deviceId = localStorage.getItem('grudge_device_id') || crypto.randomUUID();
    localStorage.setItem('grudge_device_id', deviceId);

    const res = await fetch(`${AUTH_URL}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Guest login failed');

    const parsed = parseAuthResponse(data);
    if (!parsed) return false;

    setAuth(parsed.token, { ...parsed.user, isGuest: true });
    return true;
  } catch (err) {
    console.warn('[auth] Guest login failed:', err);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// SECONDARY: OAuth providers (Discord, Google, GitHub)
// ══════════════════════════════════════════════════════════════

export function loginDiscord(): void {
  const returnUrl = window.location.origin + '/?provider=discord';
  window.location.href = `${AUTH_URL}/auth/discord?redirect_uri=${encodeURIComponent(returnUrl)}`;
}

export function loginGoogle(): void {
  const returnUrl = window.location.origin + '/?provider=google';
  window.location.href = `${AUTH_URL}/auth/google?redirect_uri=${encodeURIComponent(returnUrl)}`;
}

// ── SSO check (cross-app session from grudge_sso cookie) ─────

export function checkSSO(): void {
  const returnUrl = window.location.origin + '/?sso=true';
  window.location.href = `${AUTH_URL}/auth/sso-check?return=${encodeURIComponent(returnUrl)}`;
}

export { API_URL, AUTH_URL };
