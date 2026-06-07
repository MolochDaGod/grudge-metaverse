/**
 * Grudge Metaverse — game server entry.
 *
 * HTTP (Express) + Socket.IO on /game namespace. Protocol matches the client at
 * src/lib/multiplayer.ts: join-island / player-move (in) and
 * player-joined / player-left / player-moved (out).
 */

import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server, type Socket } from 'socket.io';

import { authenticate, type AuthedIdentity } from './auth.js';
import { World } from './game/World.js';
import { GameLoop } from './game/GameLoop.js';
import type {
  JoinIslandMsg,
  PlayerJoinedMsg,
  PlayerLeftMsg,
  PlayerMoveMsg,
} from './types.js';

const PORT = parseInt(process.env.PORT || '8001', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MOVE_RATE_LIMIT = parseInt(process.env.PLAYER_MOVE_RATE_LIMIT || '30', 10);

const corsOrigin: any = ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS;

// ── HTTP app (healthcheck + metrics) ───────────────────────────
const app = express();
app.use(cors({ origin: corsOrigin }));

const worlds = new Map<string, World>();

app.get('/', (_req, res) => res.json({ name: 'grudge-metaverse-server', ok: true }));
app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    worlds: worlds.size,
    players: [...worlds.values()].reduce((n, w) => n + w.players.size, 0),
    uptime: process.uptime(),
  }),
);

const server = http.createServer(app);

// ── Socket.IO ──────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true },
  transports: ['websocket', 'polling'],
  pingInterval: 25_000,
  pingTimeout: 20_000,
});

const game = io.of('/game');

// Per-socket rate-limiter state for player-move
interface SocketState { ident: AuthedIdentity; world?: World; moveBucket: number; moveStart: number; }
const states = new WeakMap<Socket, SocketState>();

game.use(async (socket, next) => {
  const token = (socket.handshake.auth?.token as string | undefined) ?? undefined;
  const ident = await authenticate(token, socket.id);
  if (!ident) return next(new Error('unauthorized'));
  states.set(socket, { ident, moveBucket: 0, moveStart: Date.now() });
  next();
});

function getWorld(key: string): World {
  let w = worlds.get(key);
  if (!w) { w = new World(key); worlds.set(key, w); }
  return w;
}

game.on('connection', (socket) => {
  const st = states.get(socket)!;
  console.log(`[mp] + ${st.ident.grudge_id} (${st.ident.username}) socket=${socket.id}`);

  socket.on('join-island', (msg: JoinIslandMsg) => {
    const key = (msg?.island_key || 'island_1').toString().slice(0, 64);
    const world = getWorld(key);
    if (world.full) { socket.emit('island-full', { island_key: key }); return; }

    // Leave previous island, if any
    if (st.world && st.world.key !== key) {
      st.world.removePlayer(st.ident.grudge_id);
      game.to(`island:${st.world.key}`).emit('player-left', { grudge_id: st.ident.grudge_id } satisfies PlayerLeftMsg);
      socket.leave(`island:${st.world.key}`);
    }

    const state = world.addPlayer(st.ident.grudge_id, st.ident.username);
    st.world = world;
    socket.join(`island:${key}`);
    socket.join(`player:${st.ident.grudge_id}`);

    // Seed the joiner with everyone already on the island
    for (const p of world.snapshot()) {
      if (p.grudge_id === st.ident.grudge_id) continue;
      socket.emit('player-joined', {
        grudge_id: p.grudge_id, username: p.username,
        position: p.position, rotation: p.rotation,
      } satisfies PlayerJoinedMsg);
    }

    // Announce the new player to everyone else
    socket.to(`island:${key}`).emit('player-joined', {
      grudge_id: state.grudge_id, username: state.username,
      position: state.position, rotation: state.rotation,
    } satisfies PlayerJoinedMsg);
  });

  socket.on('player-move', (msg: PlayerMoveMsg) => {
    if (!st.world || !msg?.position) return;
    // 1-second sliding rate limiter
    const now = Date.now();
    if (now - st.moveStart > 1000) { st.moveStart = now; st.moveBucket = 0; }
    if (++st.moveBucket > MOVE_RATE_LIMIT) return;

    st.world.updatePlayer(st.ident.grudge_id, msg.position, msg.rotation || 0);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[mp] - ${st.ident.grudge_id} (${reason})`);
    if (st.world) {
      st.world.removePlayer(st.ident.grudge_id);
      game.to(`island:${st.world.key}`).emit('player-left', { grudge_id: st.ident.grudge_id } satisfies PlayerLeftMsg);
    }
  });
});

const loop = new GameLoop(game, worlds);
loop.start();

server.listen(PORT, () => {
  console.log(`[srv] grudge-metaverse-server listening on :${PORT} (origins=${ALLOWED_ORIGINS.join(',')})`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`[srv] ${sig} — shutting down`);
    loop.stop();
    io.close();
    server.close(() => process.exit(0));
  });
}
