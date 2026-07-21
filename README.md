# Grudge Metaverse

3D multiplayer client (**metaverse.grudge-studio.com**) **and** the Grudge Studio **fleet control plane** (registry, probes, AI job plans).

## Two roles in one repo

| Role | What |
|------|------|
| **Player client** | Vite + Three.js multiplayer metaverse (grudge6 avatars) |
| **Fleet ops SSOT** | `fleet/registry.json` · `scripts/fleet-probe.mjs` · `workers/fleet-ops` |

Player shells that use this topology:

- [Open](https://open.grudge-studio.com) — library / Steam-like hub  
- [GRUDOX](https://github.com/MolochDaGod/grudox) — Roblox-like fleet shell  
- This metaverse client  

## Quick start (client)

```bash
npm install
npm run dev
```

## Fleet ops (agents + CI)

```bash
# Smoke every registered surface
npm run fleet:probe

# JSON for AI workers
npm run fleet:probe:json

# Apply Railway/id SSOT rewrites to vercel.json
npm run fleet:rewrites:write

# Deploy control-plane Worker
npm run fleet:ops:deploy
```

See [docs/FLEET_OPS.md](./docs/FLEET_OPS.md).

## Deploy client

```bash
npm run build
# Vercel project grudge-metaverse → metaverse.grudge-studio.com
```

Auth + characters go through same-origin `/api/*` rewrites (Railway game-data + Grudge ID).

## License

Private — Grudge Studio / Racalvin The Pirate King.
