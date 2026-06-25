#!/usr/bin/env node
/**
 * Smoke test metaverse.grudge-studio.com live stack.
 * Usage: node scripts/smoke-live.mjs [baseUrl]
 */
const base = (process.argv[2] || 'https://metaverse.grudge-studio.com').replace(/\/$/, '');

const checks = [
  { name: 'metaverse SPA', url: `${base}/`, expect: 'Grudge Metaverse' },
  { name: 'human race GLB', url: 'https://assets.grudge-studio.com/models/characters/races/human.glb', expect: null, head: true },
  { name: 'characters API (Warlords Railway)', url: `${base}/api/characters`, expectJsonArray: true },
];

let failed = 0;

for (const c of checks) {
  try {
    const res = await fetch(c.url, c.head ? { method: 'HEAD' } : {});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (c.expectJsonArray) {
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('expected JSON array');
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