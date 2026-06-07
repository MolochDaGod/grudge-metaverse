/**
 * Auth — validate a token from the client handshake against id.grudge-studio.com.
 *
 * Strategy (mirrors NotBlox's permissive auth + Grudge ID's session model):
 *   1. If a Bearer token is present, call GRUDGE_ID_URL/auth/user with it.
 *      On success, use the returned grudge_id / username.
 *   2. If no token and ALLOW_GUEST_NO_TOKEN=true, mint an ephemeral guest identity
 *      from the socket id so guests can still join.
 *   3. Otherwise, reject the connection.
 */

export interface AuthedIdentity {
  grudge_id: string;
  username: string;
  is_guest: boolean;
}

const GRUDGE_ID_URL = process.env.GRUDGE_ID_URL || 'https://id.grudge-studio.com';
const ALLOW_GUEST = (process.env.ALLOW_GUEST_NO_TOKEN ?? 'true').toLowerCase() === 'true';

export async function authenticate(
  token: string | undefined,
  socketId: string,
): Promise<AuthedIdentity | null> {
  if (token) {
    try {
      const res = await fetch(`${GRUDGE_ID_URL}/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: any = await res.json();
        const u = data.user || data.payload || data;
        const grudge_id = u.grudgeId || u.grudge_id;
        if (grudge_id) {
          return {
            grudge_id,
            username: u.username || u.displayName || u.display_name || 'Player',
            is_guest: !!(u.isGuest || u.is_guest || u.role === 'guest'),
          };
        }
      } else {
        console.warn(`[auth] token rejected (${res.status})`);
      }
    } catch (err) {
      console.warn('[auth] grudge-id lookup failed:', (err as Error).message);
    }
  }

  if (ALLOW_GUEST) {
    const short = socketId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
    return {
      grudge_id: `GUEST-${short}`,
      username: `Guest_${short}`,
      is_guest: true,
    };
  }

  return null;
}
