/**
 * Auth — Grudge ID integration for the Metaverse client.
 * Stores JWT in localStorage, handles OAuth redirects, guest login.
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
  gold: number;
  gbuxBalance: number;
  isGuest: boolean;
}

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

/** Check URL for ?token= from OAuth callback and store it */
export async function handleAuthCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || params.get('sso_token');
  if (!token) return false;

  // Clean URL
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
      walletAddress: data.walletAddress || data.serverWalletAddress,
      gold: data.gold || 0,
      gbuxBalance: data.gbuxBalance || 0,
      isGuest: data.isGuest || false,
    });
    return true;
  } catch {
    return false;
  }
}

/** Verify stored token is still valid */
export async function verifyToken(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${AUTH_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

/** Start Discord OAuth flow */
export function loginDiscord(): void {
  const returnUrl = window.location.origin + '/?provider=discord';
  window.location.href = `${AUTH_URL}/auth/discord?redirect_uri=${encodeURIComponent(returnUrl)}`;
}

/** Guest login */
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
    if (!data.success || !data.token) return false;

    setAuth(data.token, {
      grudgeId: data.grudgeId,
      username: data.username,
      displayName: data.user?.displayName || data.username,
      role: 'guest',
      faction: null, race: null, class: null,
      walletAddress: null, gold: data.user?.gold || 500,
      gbuxBalance: data.user?.gbuxBalance || 0,
      isGuest: true,
    });
    return true;
  } catch {
    return false;
  }
}

export { API_URL, AUTH_URL };
