/**
 * grudge-fleet-ops — Cloudflare Worker control plane
 *
 * Endpoints:
 *   GET  /health
 *   GET  /v1/registry          — fleet surfaces + agent roles
 *   GET  /v1/registry/:id      — single surface
 *   POST /v1/jobs              — enqueue probe/onboard (returns job plan)
 *   GET  /v1/jobs/:id          — job status (in-memory / KV if bound)
 *   POST /v1/probe             — run HTTP probes server-side for listed surfaces
 *
 * Auth: optional FLEET_OPS_TOKEN secret for write endpoints.
 * AI workers call these instead of inventing topology.
 */

export interface Env {
  FLEET_OPS_PUBLIC?: string;
  FLEET_OPS_TOKEN?: string;
  JOBS?: KVNamespace;
  /** Optional: raw registry JSON string override */
  REGISTRY_JSON?: string;
}

interface Probe {
  type?: string;
  url: string;
  method?: string;
  expectStatus?: number | number[];
  optional?: boolean;
}

interface Surface {
  id: string;
  name: string;
  role?: string;
  tier?: string;
  origin: string;
  aliases?: string[];
  repo?: string;
  deploy?: Record<string, unknown>;
  probes?: Probe[];
}

interface Registry {
  version: string;
  updatedAt?: string;
  platforms?: Record<string, unknown>;
  identity?: Record<string, unknown>;
  surfaces: Surface[];
  agentRoles?: unknown[];
  rewritesTemplate?: Record<string, string>;
}

// Embedded fallback if fetch of raw GitHub fails
const EMBEDDED: Registry = {
  version: "1.0.0-embedded",
  surfaces: [
    {
      id: "open",
      name: "Grudge Open",
      origin: "https://open.grudge-studio.com",
      probes: [{ url: "https://open.grudge-studio.com/", expectStatus: 200 }],
    },
    {
      id: "grudox",
      name: "GRUDOX",
      origin: "https://grudox.grudge-studio.com",
      probes: [{ url: "https://grudox.grudge-studio.com/", expectStatus: 200 }],
    },
    {
      id: "metaverse",
      name: "Metaverse",
      origin: "https://metaverse.grudge-studio.com",
      probes: [{ url: "https://metaverse.grudge-studio.com/", expectStatus: 200 }],
    },
  ],
};

const REGISTRY_RAW_URL =
  "https://raw.githubusercontent.com/MolochDaGod/grudge-metaverse/master/fleet/registry.json";

async function loadRegistry(env: Env): Promise<Registry> {
  if (env.REGISTRY_JSON) {
    try {
      return JSON.parse(env.REGISTRY_JSON) as Registry;
    } catch {
      /* fall through */
    }
  }
  try {
    const res = await fetch(REGISTRY_RAW_URL, {
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (res.ok) return (await res.json()) as Registry;
  } catch {
    /* fall through */
  }
  return EMBEDDED;
}

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Fleet-Ops-Token",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function authorized(req: Request, env: Env, write: boolean): boolean {
  if (!write && env.FLEET_OPS_PUBLIC === "1") return true;
  if (!env.FLEET_OPS_TOKEN) return !write; // no secret → read-only public
  const h =
    req.headers.get("X-Fleet-Ops-Token") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  return h === env.FLEET_OPS_TOKEN;
}

function json(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: cors(origin),
  });
}

async function runHttpProbe(p: Probe): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(p.url, {
      method: p.method || "GET",
      redirect: "follow",
    });
    const want = p.expectStatus;
    const okList = Array.isArray(want) ? want : [want ?? 200];
    return { ok: okList.includes(res.status), detail: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (path === "/health" || path === "/") {
      return json(
        {
          ok: true,
          service: "grudge-fleet-ops",
          role: "control-plane",
          endpoints: [
            "GET /health",
            "GET /v1/registry",
            "GET /v1/registry/:id",
            "POST /v1/jobs",
            "POST /v1/probe",
          ],
        },
        200,
        origin,
      );
    }

    const registry = await loadRegistry(env);

    if (path === "/v1/registry" && req.method === "GET") {
      if (!authorized(req, env, false)) return json({ error: "unauthorized" }, 401, origin);
      return json(registry, 200, origin);
    }

    const one = path.match(/^\/v1\/registry\/([a-z0-9-]+)$/i);
    if (one && req.method === "GET") {
      const s = registry.surfaces.find((x) => x.id === one[1]);
      if (!s) return json({ error: "not_found" }, 404, origin);
      return json(s, 200, origin);
    }

    if (path === "/v1/probe" && req.method === "POST") {
      if (!authorized(req, env, true)) return json({ error: "unauthorized" }, 401, origin);
      let body: { surfaces?: string[] } = {};
      try {
        body = (await req.json()) as { surfaces?: string[] };
      } catch {
        /* empty = all */
      }
      const list = body.surfaces?.length
        ? registry.surfaces.filter((s) => body.surfaces!.includes(s.id))
        : registry.surfaces;

      const results: Array<Record<string, unknown>> = [];
      let fail = 0;
      for (const s of list) {
        const probes = s.probes || [{ url: s.origin + "/", expectStatus: 200 }];
        for (const p of probes) {
          if (p.type === "ws") {
            results.push({
              surface: s.id,
              url: p.url,
              type: "ws",
              ok: null,
              detail: "ws probes run client-side (fleet-probe.mjs)",
              optional: true,
            });
            continue;
          }
          const r = await runHttpProbe(p);
          if (!r.ok && !p.optional) fail++;
          results.push({
            surface: s.id,
            url: p.url,
            type: "http",
            ok: r.ok,
            detail: r.detail,
            optional: !!p.optional,
          });
        }
      }
      return json({ ok: fail === 0, fail, results }, 200, origin);
    }

    if (path === "/v1/jobs" && req.method === "POST") {
      if (!authorized(req, env, true)) return json({ error: "unauthorized" }, 401, origin);
      let body: { type?: string; surface?: string; payload?: unknown } = {};
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return json({ error: "invalid_json" }, 400, origin);
      }
      const type = body.type || "probe";
      const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const job = {
        id,
        type,
        surface: body.surface || null,
        status: "planned",
        createdAt: new Date().toISOString(),
        plan: buildJobPlan(type, body.surface, registry),
        payload: body.payload ?? null,
      };
      if (env.JOBS) {
        ctx.waitUntil(env.JOBS.put(id, JSON.stringify(job), { expirationTtl: 86400 * 7 }));
      }
      return json(job, 201, origin);
    }

    const jobGet = path.match(/^\/v1\/jobs\/([a-z0-9_]+)$/i);
    if (jobGet && req.method === "GET") {
      if (!env.JOBS) {
        return json({ error: "kv_not_bound", hint: "bind JOBS KV for durable job status" }, 501, origin);
      }
      const raw = await env.JOBS.get(jobGet[1]);
      if (!raw) return json({ error: "not_found" }, 404, origin);
      return json(JSON.parse(raw), 200, origin);
    }

    return json({ error: "not_found", path }, 404, origin);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Cron: run HTTP probes for critical surfaces
    const registry = await loadRegistry(env);
    const critical = ["open", "grudox", "metaverse", "id", "game-data"];
    ctx.waitUntil(
      (async () => {
        for (const id of critical) {
          const s = registry.surfaces.find((x) => x.id === id);
          if (!s?.probes?.[0]) continue;
          await runHttpProbe(s.probes[0]);
        }
      })(),
    );
  },
};

function buildJobPlan(
  type: string,
  surfaceId: string | undefined,
  registry: Registry,
): Record<string, unknown> {
  const surface = surfaceId
    ? registry.surfaces.find((s) => s.id === surfaceId)
    : null;

  switch (type) {
    case "probe":
      return {
        steps: [
          "node scripts/fleet-probe.mjs" + (surfaceId ? ` --surface ${surfaceId}` : ""),
          "Exit non-zero on required FAIL",
        ],
        surface: surface || null,
      };
    case "onboard":
      return {
        steps: [
          "Phase A: id.grudge-studio.com redirect_uri allowlist",
          "Phase B: generate-vercel-rewrites.mjs --write",
          "Phase C: probe /api/characters + /api/auth/me",
          "Phase F: register surface in fleet/registry.json",
          "Phase G: fleet-probe --strict optional gates as needed",
        ],
        skill: "grudge-game-onboarding",
        surface: surface || null,
      };
    case "deploy":
      return {
        steps: [
          "git push → CI (never silent prod edit)",
          surface?.deploy || "vercel deploy --prod / railway up / wrangler deploy",
          "POST /v1/probe after deploy",
        ],
        surface: surface || null,
      };
    case "grudox_rebuild":
      return {
        steps: [
          "repository_dispatch rebuild-grudox-fleet on MolochDaGod/grudox",
          "npm run probe in grudox after deploy",
          "fleet-probe --surface grudox",
        ],
        repo: "MolochDaGod/grudox",
      };
    default:
      return {
        steps: [`Unknown job type "${type}" — use probe | onboard | deploy | grudox_rebuild`],
      };
  }
}
