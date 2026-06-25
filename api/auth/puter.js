/**
 * Server-side proxy for guest/Puter auth — strips Origin so Railway CORS allowlist
 * does not block metaverse.grudge-studio.com (Vercel rewrites forward browser Origin).
 */
const RAILWAY = 'https://grudge-builder-production.up.railway.app';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const upstream = await fetch(`${RAILWAY}/api/auth/puter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body ?? {}),
  });

  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) res.setHeader('Set-Cookie', setCookie);

  const contentType = upstream.headers.get('content-type') || 'application/json';
  const body = await upstream.text();
  res.status(upstream.status);
  res.setHeader('Content-Type', contentType);
  res.end(body);
}