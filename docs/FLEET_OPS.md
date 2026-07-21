# Grudge Fleet Ops (Roblox-style control plane)

**Repo:** [grudge-metaverse](https://github.com/MolochDaGod/grudge-metaverse)  
**Player shells:** [Open](https://open.grudge-studio.com) · [GRUDOX](https://grudox.grudge-studio.com) · [Metaverse](https://metaverse.grudge-studio.com)

This repo hosts the **fleet registry + probe + fleet-ops Worker** so AI agents and humans share one topology for manage / update / debug / deploy.

## Layout

```
fleet/
  registry.json          # SSOT: surfaces, probes, agent roles, rewrite template
  registry.schema.json
scripts/
  fleet-probe.mjs        # CLI probe (CI + local + agents)
  generate-vercel-rewrites.mjs
  smoke-live.mjs         # metaverse-only smoke (legacy + still valid)
workers/fleet-ops/       # CF Worker control plane API
docs/FLEET_OPS.md        # this file
```

## Platforms

| Platform | Role |
|----------|------|
| **Cloudflare** | DNS, Workers (fleet-ops, grudox edge), R2 CDN, AI Gateway |
| **Vercel** | Browser SPAs (Open, Metaverse, GRUDOX shell) |
| **Railway** | Game-data Postgres, GRUDOX rooms, long-lived WS |
| **Puter** | User-pays tools only — **never** character SSOT |

## Agent workflow

```
Intent (onboard | probe | deploy | grudox_rebuild)
  → GET  /v1/registry          (topology)
  → POST /v1/jobs { type }     (plan steps)
  → run steps via git + CI
  → node scripts/fleet-probe.mjs
  → POST /v1/probe             (optional edge recheck)
```

Job types: `probe` · `onboard` · `deploy` · `grudox_rebuild`

## Local commands

```bash
# Full fleet smoke
node scripts/fleet-probe.mjs

# Subset
node scripts/fleet-probe.mjs --surface open,grudox,metaverse

# JSON for agents
node scripts/fleet-probe.mjs --json

# Fix metaverse vercel rewrites from registry SSOT
node scripts/generate-vercel-rewrites.mjs --write
```

## Deploy fleet-ops Worker

```bash
cd workers/fleet-ops
npx wrangler deploy
# Optional secret for write endpoints:
# npx wrangler secret put FLEET_OPS_TOKEN
```

## GRUDOX coupling

| Item | Location |
|------|----------|
| App + dist shell | [MolochDaGod/grudox](https://github.com/MolochDaGod/grudox) |
| Edge WS proxy | grudge-studio `infra/cloudflare/grudox` or CF worker route |
| Room | Railway `voxgrudge-grudox-room` |
| Probe | `grudox` → `npm run probe` + this registry surface `grudox` |
| Rebuild | GitHub `repository_dispatch` type `rebuild-grudox-fleet` |

## Hard rules

1. Characters / wallet / account → Railway `grudge-api-production-0d46` only  
2. No second auth stack per game  
3. Agents change **git + CI**, not silent production  
4. Assets: ObjectStore defs + R2 binaries; no git mega-GLB ships  
5. Update `fleet/registry.json` when adding a domain/game  

## Related skills

- `grudge-fleet` · `grudge-live-servers` · `grudge-game-onboarding` · `grudge-production-wiring`
