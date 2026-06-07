/**
 * GameLoop — fixed-tickrate authoritative simulation, NotBlox-style.
 *
 * Runs at GAME_TICKRATE Hz. Each tick:
 *   1. Calls onTick (currently a no-op — physics/AI hooks can plug in here)
 *   2. Asks each world for its dirty PlayerStates and broadcasts them.
 *
 * This decouples broadcast frequency from client send frequency, which keeps
 * bandwidth predictable even if clients spam player-move events.
 */

import type { Namespace } from 'socket.io';
import type { World } from './World.js';
import type { PlayerMovedMsg } from '../types.js';

const TICKRATE = Math.max(5, Math.min(120, parseInt(process.env.GAME_TICKRATE || '20', 10)));
const TICK_MS = 1000 / TICKRATE;

export class GameLoop {
  private timer: NodeJS.Timeout | null = null;
  private readonly worlds: Map<string, World>;
  private readonly nsp: Namespace;
  private tick = 0;

  constructor(nsp: Namespace, worlds: Map<string, World>) {
    this.nsp = nsp;
    this.worlds = worlds;
  }

  start(): void {
    if (this.timer) return;
    console.log(`[loop] starting at ${TICKRATE} Hz (${TICK_MS.toFixed(1)}ms/tick)`);
    this.timer = setInterval(() => this.step(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private step(): void {
    this.tick++;
    for (const world of this.worlds.values()) {
      const dirty = world.drainDirty();
      if (dirty.length === 0) continue;

      // Broadcast each moved player to everyone else in the island room.
      // (Sender excluded so the client doesn't fight its own state.)
      for (const p of dirty) {
        const msg: PlayerMovedMsg = {
          grudge_id: p.grudge_id,
          position: p.position,
          rotation: p.rotation,
        };
        this.nsp.to(`island:${world.key}`).except(`player:${p.grudge_id}`).emit('player-moved', msg);
      }
    }

    // Prune empty worlds occasionally (every ~10s)
    if (this.tick % (TICKRATE * 10) === 0) {
      for (const [key, world] of this.worlds) {
        if (world.players.size === 0) this.worlds.delete(key);
      }
    }
  }
}
