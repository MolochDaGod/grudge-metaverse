/**
 * Multiplayer — Socket.IO client for real-time player synchronization.
 * Connects to ws.grudge-studio.com/game namespace.
 */

import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { getToken } from './auth';

const WS_URL = 'https://ws.grudge-studio.com';

export interface RemotePlayer {
  grudgeId: string;
  username: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  mesh: THREE.Group;
}

let socket: Socket | null = null;
const remotePlayers = new Map<string, RemotePlayer>();
let scene: THREE.Scene | null = null;

// Capsule template for remote players
function createPlayerMesh(username: string): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.2, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x44aaff, roughness: 0.5, metalness: 0.3 }),
  );
  body.position.y = 1;
  body.castShadow = true;
  group.add(body);

  // Name label (simple sprite)
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c8a84b';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(username, 128, 40);

  const tex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  label.position.y = 2.8;
  label.scale.set(3, 0.75, 1);
  group.add(label);

  return group;
}

export function connect(sceneRef: THREE.Scene, island: string = 'island_1'): Socket | null {
  const token = getToken();
  if (!token) return null;
  scene = sceneRef;

  socket = io(`${WS_URL}/game`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[MP] Connected to game server');
    socket!.emit('join-island', { island_key: island });
  });

  socket.on('player-joined', (data: { grudge_id: string; username: string; position?: any }) => {
    if (remotePlayers.has(data.grudge_id)) return;
    const mesh = createPlayerMesh(data.username || 'Player');
    if (data.position) mesh.position.set(data.position.x, data.position.y, data.position.z);
    scene?.add(mesh);
    remotePlayers.set(data.grudge_id, {
      grudgeId: data.grudge_id,
      username: data.username || 'Player',
      position: data.position || { x: 0, y: 0, z: 0 },
      rotation: 0,
      mesh,
    });
    console.log(`[MP] ${data.username} joined`);
  });

  socket.on('player-left', (data: { grudge_id: string }) => {
    const p = remotePlayers.get(data.grudge_id);
    if (p) {
      scene?.remove(p.mesh);
      remotePlayers.delete(data.grudge_id);
      console.log(`[MP] ${p.username} left`);
    }
  });

  socket.on('player-moved', (data: { grudge_id: string; position: any; rotation: number }) => {
    const p = remotePlayers.get(data.grudge_id);
    if (p) {
      p.position = data.position;
      p.rotation = data.rotation;
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[MP] Disconnected:', reason);
  });

  return socket;
}

/** Send local player position to server */
export function broadcastPosition(position: THREE.Vector3, rotation: number): void {
  socket?.emit('player-move', {
    position: { x: position.x, y: position.y, z: position.z },
    rotation,
  });
}

/** Interpolate remote player positions (call in animation loop) */
export function updateRemotePlayers(dt: number): void {
  for (const [, p] of remotePlayers) {
    p.mesh.position.lerp(
      new THREE.Vector3(p.position.x, p.position.y, p.position.z),
      dt * 8,
    );
    p.mesh.rotation.y += (p.rotation - p.mesh.rotation.y) * dt * 8;
  }
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
  for (const [, p] of remotePlayers) {
    scene?.remove(p.mesh);
  }
  remotePlayers.clear();
}

export function getRemotePlayers(): Map<string, RemotePlayer> {
  return remotePlayers;
}
