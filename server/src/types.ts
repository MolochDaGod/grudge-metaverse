/**
 * Shared network types — must stay in sync with the client (src/lib/multiplayer.ts).
 * Naming style (snake_case for IDs) mirrors what the client already emits/listens for.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  grudge_id: string;
  username: string;
  position: Vec3;
  rotation: number;
  island: string;
  last_seen: number;
  // True when state changed this tick and needs to be broadcast.
  dirty: boolean;
}

// ── Inbound (client → server) ────────────────────────────────
export interface JoinIslandMsg { island_key: string; }
export interface PlayerMoveMsg { position: Vec3; rotation: number; }

// ── Outbound (server → client) ───────────────────────────────
export interface PlayerJoinedMsg {
  grudge_id: string;
  username: string;
  position: Vec3;
  rotation: number;
}
export interface PlayerLeftMsg { grudge_id: string; }
export interface PlayerMovedMsg {
  grudge_id: string;
  position: Vec3;
  rotation: number;
}
