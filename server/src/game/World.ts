/**
 * World — one game world per island. Holds all PlayerState for a given island_key.
 * Mirrors NotBlox's per-script world concept: isolated state, broadcast at tick rate.
 */

import type { PlayerState, Vec3 } from '../types.js';

const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS_PER_ISLAND || '64', 10);

export class World {
  readonly key: string;
  readonly players = new Map<string, PlayerState>(); // grudge_id → state

  constructor(key: string) {
    this.key = key;
  }

  get full(): boolean {
    return this.players.size >= MAX_PLAYERS;
  }

  addPlayer(grudge_id: string, username: string, spawn?: Vec3): PlayerState {
    const state: PlayerState = {
      grudge_id,
      username,
      position: spawn ?? { x: 0, y: 5, z: 0 },
      rotation: 0,
      island: this.key,
      last_seen: Date.now(),
      dirty: true, // broadcast on join
    };
    this.players.set(grudge_id, state);
    return state;
  }

  removePlayer(grudge_id: string): PlayerState | undefined {
    const p = this.players.get(grudge_id);
    if (p) this.players.delete(grudge_id);
    return p;
  }

  updatePlayer(grudge_id: string, position: Vec3, rotation: number): void {
    const p = this.players.get(grudge_id);
    if (!p) return;
    // Sanity bounds — reject obvious teleport cheats.
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) return;
    if (Math.abs(position.x) > 10_000 || Math.abs(position.z) > 10_000) return;

    p.position = position;
    p.rotation = rotation;
    p.last_seen = Date.now();
    p.dirty = true;
  }

  /** Players whose state changed since the last broadcast. */
  drainDirty(): PlayerState[] {
    const out: PlayerState[] = [];
    for (const p of this.players.values()) {
      if (p.dirty) {
        out.push(p);
        p.dirty = false;
      }
    }
    return out;
  }

  /** Returns the full roster — used to seed a newly joined player. */
  snapshot(): PlayerState[] {
    return [...this.players.values()];
  }
}
