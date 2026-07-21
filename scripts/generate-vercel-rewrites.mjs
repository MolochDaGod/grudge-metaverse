#!/usr/bin/env node
/**
 * Generate fleet satellite Vercel rewrites from fleet/registry.json.
 *
 * Usage:
 *   node scripts/generate-vercel-rewrites.mjs
 *   node scripts/generate-vercel-rewrites.mjs --out vercel.rewrites.json
 *   node scripts/generate-vercel-rewrites.mjs --write   # merge into vercel.json
 *
 * SSOT destinations match grudge-game-onboarding / grudge-fleet skills.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const registry = JSON.parse(readFileSync(join(root, "fleet", "registry.json"), "utf8"));
const t = registry.rewritesTemplate;

const rewrites = [
  // Auth callback must hit SPA, not API proxy
  { source: "/auth/callback", destination: "/index.html" },
  // Characters + account → Railway game-data SSOT
  { source: "/api/characters", destination: `${t.gameData}/api/characters` },
  { source: "/api/characters/:path*", destination: `${t.gameData}/api/characters/:path*` },
  { source: "/api/account/:path*", destination: `${t.gameData}/api/account/:path*` },
  { source: "/api/wallet/:path*", destination: `${t.gameData}/api/wallet/:path*` },
  { source: "/api/inventory/:path*", destination: `${t.gameData}/api/inventory/:path*` },
  { source: "/api/island/:path*", destination: `${t.gameData}/api/island/:path*` },
  // Auth session paths that must hit Railway first (when present)
  { source: "/api/auth/me", destination: `${t.gameData}/api/auth/me` },
  { source: "/api/auth/verify", destination: `${t.gameData}/api/auth/verify` },
  { source: "/api/auth/session/exchange", destination: `${t.gameData}/api/auth/session/exchange` },
  { source: "/api/auth/puter", destination: `${t.gameData}/api/auth/puter` },
  { source: "/api/auth/guest", destination: `${t.gameData}/api/auth/guest` },
  // Remaining auth → Grudge ID
  { source: "/api/auth/:path*", destination: `${t.auth}/api/auth/:path*` },
  { source: "/auth/:path*", destination: `${t.auth}/auth/:path*` },
  { source: "/login", destination: `${t.auth}/login` },
  // Assets + catalogs
  { source: "/api/objectstore/:path*", destination: `${t.objectstore}/:path*` },
  { source: "/api/assets/:path*", destination: `${t.assets}/:path*` },
  { source: "/assets-cdn/:path*", destination: `${t.assets}/:path*` },
  { source: "/models/grudge6/:path*", destination: `${t.assets}/models/grudge6/:path*` },
  { source: "/api/ai/:path*", destination: `${t.ai}/:path*` },
  // SPA fallback last
  { source: "/(.*)", destination: "/index.html" },
];

const outArg = argsOut();
const write = process.argv.includes("--write");

function argsOut() {
  const i = process.argv.indexOf("--out");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

if (write) {
  const vercelPath = join(root, "vercel.json");
  let vercel = {};
  if (existsSync(vercelPath)) {
    vercel = JSON.parse(readFileSync(vercelPath, "utf8"));
  }
  vercel.rewrites = rewrites;
  if (!vercel.headers) {
    vercel.headers = [
      {
        source: "/assets/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/(.*)\\.js",
        headers: [{ key: "Content-Type", value: "application/javascript; charset=utf-8" }],
      },
    ];
  }
  writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + "\n");
  console.log("Wrote vercel.json rewrites from fleet registry");
} else if (outArg) {
  writeFileSync(outArg, JSON.stringify({ rewrites }, null, 2) + "\n");
  console.log("Wrote", outArg);
} else {
  console.log(JSON.stringify({ rewrites }, null, 2));
}
