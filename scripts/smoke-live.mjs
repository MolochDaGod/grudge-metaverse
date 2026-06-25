#!/usr/bin/env node
/**
 * Smoke test metaverse.grudge-studio.com live stack.
 * Usage: node scripts/smoke-live.mjs [baseUrl]
 */
const base = (process.argv[2] || 'https://metaverse.grudge-studio.com').replace(/\/$/, '');

const checks = [
  { name: 'metaverse SPA', url: `${base}/`, expect: 'Grudge Metaverse' },
  { name: 'race human GLB', url: 'https://assets.grudge-studio.com/models/characters/races/human.glb', head: true },
  { name: 'bundled avatar (optional)', url: 'https://assets.grudge-studio.com/models/grudge6/metaverse/human.glb', head: true, optional: true },
  { name: 'Bip001 walk anim', url: 'https://assets.grudge-studio.com/models/animations/retargeted/bip001/paragon_walk.glb', head: true },
  { name: 'characters API (Warlords Railway)', url: `${base}/api/characters`, expectJsonArray: true },
  { name: 'guest auth (puter proxy)', url: `${base}/api/auth/puter`, method: 'POST', body: { puterId: 'guest_smoke', displayName: 'Guest' }, expectField: 'success' },
];

let failed = 0;

// Free-play roster ships in the JS bundle (not index.html shell).
try {
  const html = await (await fetch(`${base}/`)).text();
  const m = html.match(/\/assets\/(index-[^"]+\.js)/);
  if (!m) throw new Error('bundle script not found in index.html');
  const js = await (await fetch(`${base}/assets/${m[1]}`)).text();
  if (!js.includes('Free Play') || !js.includes('freeplay_')) {
    throw new Error('free-play roster missing from bundle');
  }
  console.log('OK  free play in bundle');
} catch (err) {
  console.log(`FAIL free play in bundle: ${err.message}`);
  failed++;
}

for (const c of checks) {
  try {
    const init = c.head
      ? { method: 'HEAD' }
      : c.method === 'POST'
        ? { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(c.body || {}) }
        : {};
    const res = await fetch(c.url, init);
    if (!res.ok) {
      if (c.optional) { console.log(`SKIP ${c.name} (not baked yet)`); continue; }
      throw new Error(`HTTP ${res.status}`);
    }
    if (c.expectJsonArray) {
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('expected JSON array');
    } else if (c.expectField) {
      const data = await res.json();
      if (!(c.expectField in data)) throw new Error(`missing field "${c.expectField}"`);
    } else if (c.expect) {
      const text = await res.text();
      if (!text.includes(c.expect)) throw new Error(`missing "${c.expect}"`);
    }
    console.log(`OK  ${c.name}`);
  } catch (err) {
    console.log(`FAIL ${c.name}: ${err.message}`);
    failed++;
  }
}

process.exit(failed ? 1 : 0);