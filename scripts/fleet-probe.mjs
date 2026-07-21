#!/usr/bin/env node
/**
 * Fleet probe — smoke every surface in fleet/registry.json.
 *
 * Usage:
 *   node scripts/fleet-probe.mjs
 *   node scripts/fleet-probe.mjs --surface open,grudox,metaverse
 *   node scripts/fleet-probe.mjs --json
 *   node scripts/fleet-probe.mjs --strict   # optional probes count as fail
 *
 * Exit 0 only when all required probes pass. Designed for CI + AI workers.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const registryPath = join(__dirname, "..", "fleet", "registry.json");
const registry = JSON.parse(readFileSync(registryPath, "utf8"));

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const strict = args.includes("--strict");
const surfaceArg = args.find((a) => a.startsWith("--surface="))?.slice("--surface=".length)
  || (args.includes("--surface") ? args[args.indexOf("--surface") + 1] : null);
const filterIds = surfaceArg
  ? surfaceArg.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const surfaces = registry.surfaces.filter(
  (s) => !filterIds || filterIds.includes(s.id),
);

const results = [];
let requiredFail = 0;
let optionalFail = 0;

async function probeHttp(p) {
  const method = p.method || "GET";
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), p.timeoutMs || 12000);
  try {
    const res = await fetch(p.url, { method, signal: controller.signal, redirect: "follow" });
    clearTimeout(t);
    const want = p.expectStatus;
    const okList = Array.isArray(want) ? want : [want ?? 200];
    const ok = okList.includes(res.status);
    return { ok, detail: `HTTP ${res.status}` };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, detail: e.message || String(e) };
  }
}

function probeWs(p) {
  return new Promise((resolve) => {
    const WS = globalThis.WebSocket;
    if (!WS) {
      resolve({ ok: false, detail: "WebSocket unavailable (need Node 22+)" });
      return;
    }
    let settled = false;
    const done = (ok, detail) => {
      if (settled) return;
      settled = true;
      resolve({ ok, detail });
    };
    try {
      const ws = new WS(p.url);
      const timer = setTimeout(() => {
        try { ws.close(); } catch { /* */ }
        done(false, "timeout");
      }, p.timeoutMs || 10000);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        try { ws.close(); } catch { /* */ }
        done(true, "ws-open");
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        done(false, "ws-error");
      });
    } catch (e) {
      done(false, e.message || String(e));
    }
  });
}

async function runProbe(surface, p) {
  if (p.type === "ws") return probeWs(p);
  return probeHttp(p);
}

for (const surface of surfaces) {
  const probes = surface.probes || [
    { type: "http", url: surface.origin + "/", expectStatus: 200 },
  ];
  for (const p of probes) {
    const optional = !!p.optional && !strict;
    const r = await runProbe(surface, p);
    const row = {
      surface: surface.id,
      name: surface.name,
      url: p.url,
      type: p.type || "http",
      optional,
      ok: r.ok,
      detail: r.detail,
    };
    results.push(row);
    if (!r.ok) {
      if (optional) optionalFail++;
      else requiredFail++;
    }
    if (!asJson) {
      const tag = r.ok ? "OK  " : optional ? "SKIP" : "FAIL";
      console.log(`${tag} [${surface.id}] ${p.url} — ${r.detail}`);
    }
  }
}

const summary = {
  version: registry.version,
  surfaces: surfaces.length,
  total: results.length,
  passed: results.filter((r) => r.ok).length,
  requiredFail,
  optionalFail,
  ok: requiredFail === 0,
  results,
};

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(
    `\n${summary.passed}/${summary.total} probes green` +
      (requiredFail ? ` · ${requiredFail} required FAIL` : " · all required green") +
      (optionalFail ? ` · ${optionalFail} optional miss` : ""),
  );
}

process.exit(summary.ok ? 0 : 1);
