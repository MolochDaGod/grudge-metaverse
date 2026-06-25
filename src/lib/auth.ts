/**
 * Auth — Grudge Studio authentication for the Metaverse client.
 *
 * The Grudge ID backend (id.grudge-studio.com) uses COOKIE-BASED auth:
 *   - Session cookie: gs_player_session (Domain=.grudge-studio.com, HttpOnly)
 *   - Response body: user data (grudgeId, username, role, etc.) — NO JWT in body
 *   - SSO redirect flow: returns ?sso_token=JWT&grudge_id=GRDG-XXXX in URL
 *
 * Auth strategies (in order of reliability):
 *   1. SSO redirect — "Enter with Grudge ID" → id.grudge-studio.com/login → returns JWT in URL
 *   2. Guest device — POST /auth/puter with guest device ID → cookie session + user data
 *   3. OAuth redirects — Discord/Google → id.grudge-studio.com → SSO redirect back
 *
 * On *.grudge-studio.com subdomains, the cookie handles subsequent API auth.
 * On other domains (Vercel previews), only SSO-provided JWTs work for API calls.
 */

// Vite dev proxy & Vercel rewrites both route /api/auth/* → id.grudge-studio.com/auth/*
const AUTH_BASE = '/api/auth';
export const API_URL = '/api';

// Direct URL — only used for browser redirects (SSO, OAuth), not fetch()
const AUTH_DIRECT = 'https://id.grudge-studio.com';

const TOKEN_KEY = 'grudge_auth_token';
const USER_KEY = 'grudge_user';
const DEVICE_ID_KEY = 'grudge_device_id';

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

/** True if we have a session (either JWT token or stored user data). */
export function isAuthenticated(): boolean {
  return !!getToken() || !!getUser();
}

export function getUser(): GrudgeUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(token: string | null, user: GrudgeUser): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
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
    ? { Authorization: `Bearer ${token}`, 'X-Session-Token': token, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

// ── Parse user data from backend response ────────────────────
// Backend returns flat user object (no nested .user, no .token in body).
// Token comes from SSO URL params or cookies, not the response body.

function parseUserFromResponse(data: any): GrudgeUser {
  const u = data.user || data;
  return {
    grudgeId: u.grudgeId || u.grudge_id || '',
    username: u.username || '',
    displayName: u.displayName || u.display_name || u.username || '',
    role: u.role || 'guest',
    faction: u.faction || null,
    race: u.race || null,
    class: u.class || null,
    walletAddress: u.walletAddress || u.wallet_address || null,
    serverWalletAddress: u.serverWalletAddress || u.server_wallet_address || null,
    gold: u.gold ?? 1000,
    gbuxBalance: parseFloat(u.gbuxBalance || u.gbux_balance || '0'),
    isGuest: !!(u.isGuest || u.is_guest || u.role === 'guest'),
    puterUuid: u.puterUuid || u.puter_uuid || null,
  };
}

// ── Bridge grudge_token (id.grudge-studio.com launch JWT) → Railway session ──
// Matches grudge-fleet.js / GrudgeBuilder wireGrudgeFleet flow.

function cleanUrlParams(keys: string[]): void {
  const params = new URLSearchParams(window.location.search);
  keys.forEach((k) => params.delete(k));
  const clean = params.toString();
  window.history.replaceState(
    {},
    '',
    window.location.pathname + (clean ? `?${clean}` : '') + window.location.hash,
  );
}

export async function bridgeGrudgeLaunchToken(launchToken: string): Promise<boolean> {
  try {
    const exchange = await fetch(`${API_URL}/auth/session/exchange`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: launchToken, audience: window.location.origin }),
    });
    if (!exchange.ok) {
      console.warn('[auth] session/exchange failed:', exchange.status);
      return false;
    }
    const profile = await exchange.json();

    const bridge = await fetch(`${AUTH_BASE}/puter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        puterId: `grudge_${profile.grudgeId}`,
        puterUuid: `grudge_${profile.grudgeId}`,
        displayName: profile.displayName || profile.username,
      }),
    });
    if (!bridge.ok) {
      console.warn('[auth] Railway puter bridge failed:', bridge.status);
      return false;
    }

    const data = await bridge.json();
    const user = parseUserFromResponse(data);
    const token = data.sessionToken || data.token || null;
    if (!user.grudgeId) return false;
    setAuth(token, { ...user, isGuest: false });
    console.log('[auth] grudge_token session:', user.grudgeId, user.username);
    return true;
  } catch (err) {
    console.warn('[auth] grudge_token bridge failed:', err);
    return false;
  }
}

// ── Handle SSO callback tokens in URL ────────────────────────
// Supports: ?grudge_token=JWT (fleet SSO), ?sso_token=JWT&grudge_id=...

export async function handleAuthCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);

  const launchToken = params.get('grudge_token');
  if (launchToken) {
    cleanUrlParams(['grudge_token']);
    return bridgeGrudgeLaunchToken(launchToken);
  }

  const token = params.get('sso_token') || params.get('token');
  if (!token) return false;

  // Extract user info from URL params (id.grudge-studio.com sends these)
  const grudgeId = params.get('grudge_id') || params.get('grudgeId') || '';
  const username = params.get('grudge_username') || params.get('username') || '';

  cleanUrlParams(['sso_token', 'token', 'grudge_id', 'grudgeId', 'grudge_username', 'username']);

  // Store immediately from params so we don't lose the session
  if (grudgeId) {
    setAuth(token, {
      grudgeId,
      username: username || 'Player',
      displayName: username || 'Player',
      role: 'player',
      faction: null, race: null, class: null,
      walletAddress: null, serverWalletAddress: null,
      gold: 1000, gbuxBalance: 0,
      isGuest: false, puterUuid: null,
    });
  }

  // Try to validate the token and get full user data
  try {
    const res = await fetch(`${AUTH_BASE}/user`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      const user = parseUserFromResponse(data.user || data.payload || data);
      setAuth(token, user);
    }
  } catch (err) {
    console.warn('[auth] SSO token validation failed (using URL params):', err);
  }

  return !!getToken();
}

// ══════════════════════════════════════════════════════════════
// PRIMARY: SSO redirect to Grudge ID login page
// ══════════════════════════════════════════════════════════════
// This is the most reliable auth method for non-grudge-studio.com domains.
// The user authenticates at id.grudge-studio.com (supports Puter, Discord,
// Google, wallet) and is redirected back with ?sso_token=JWT&grudge_id=...

export function loginWithSSO(): void {
  const returnUrl = window.location.origin + '/';
  window.location.href = `${AUTH_DIRECT}/login?redirect_uri=${encodeURIComponent(returnUrl)}`;
}

// ══════════════════════════════════════════════════════════════
// GUEST: Device-based guest login
// ══════════════════════════════════════════════════════════════
// Matches GrudgeBuilder pattern: POST to /auth/puter with a synthetic
// guest device ID. Backend creates/returns a guest account.
//
// The session cookie (gs_player_session) handles subsequent API auth
// on *.grudge-studio.com subdomains. On other domains, the guest can
// enter the world but won't have persistent character API access.

export async function loginGuest(): Promise<boolean> {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = 'gm_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    // Use /auth/puter with guest_ prefix (matching GrudgeBuilder's loginAsGuest)
    const res = await fetch(`${AUTH_BASE}/puter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Receive & store session cookie if domain matches
      body: JSON.stringify({
        puterId: `guest_${deviceId}`,
        displayName: 'Guest',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || err.message || `Guest login failed (${res.status})`);
    }

    const data = await res.json();
    const user = parseUserFromResponse(data);

    if (!user.grudgeId) throw new Error('No Grudge ID returned for guest');

    // Backend returns user data in body + session cookie.
    // Token field may or may not exist — store what we have.
    const token = data.sessionToken || data.token || null;
    setAuth(token, { ...user, isGuest: true });

    console.log('[auth] Guest session:', user.grudgeId, user.username);
    return true;
  } catch (err: any) {
    console.warn('[auth] Guest login failed:', err?.message || err);
    lastAuthError = err?.message || 'Guest login failed';
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// SECONDARY: OAuth providers (redirect to id.grudge-studio.com)
// ══════════════════════════════════════════════════════════════

export function loginDiscord(): void {
  const returnUrl = window.location.origin + '/?provider=discord';
  window.location.href = `${AUTH_DIRECT}/auth/discord?redirect_uri=${encodeURIComponent(returnUrl)}`;
}

export function loginGoogle(): void {
  const returnUrl = window.location.origin + '/?provider=google';
  window.location.href = `${AUTH_DIRECT}/auth/google?redirect_uri=${encodeURIComponent(returnUrl)}`;
}

// ── SSO check (cross-app session from grudge_sso cookie) ─────

export function checkSSO(): void {
  const returnUrl = window.location.origin + '/?sso=true';
  window.location.href = `${AUTH_DIRECT}/auth/sso-check?return=${encodeURIComponent(returnUrl)}`;
}

// ── Last error (for UI feedback) ─────────────────────────────

let lastAuthError: string | null = null;

export function getLastAuthError(): string | null {
  const err = lastAuthError;
  lastAuthError = null;
  return err;
}

export { AUTH_DIRECT as AUTH_URL };
