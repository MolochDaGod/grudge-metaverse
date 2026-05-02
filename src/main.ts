/**
 * Grudge Metaverse — Main entry point with hash-based router.
 * Routes: #/ (landing), #/lobby, #/play
 */

import { handleAuthCallback } from './lib/auth';
import { mountLanding } from './pages/landing';
import { mountLobby } from './pages/lobby';
import { mountPlay } from './pages/play';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

type Route = '/' | '/lobby' | '/play';

const routes: Record<Route, (container: HTMLElement) => () => void> = {
  '/': mountLanding,
  '/lobby': mountLobby,
  '/play': mountPlay,
};

function navigate() {
  if (cleanup) { cleanup(); cleanup = null; }
  app.innerHTML = '';

  const hash = window.location.hash.replace('#', '') || '/';
  const route = hash.split('?')[0] as Route;
  const mount = routes[route] || routes['/'];
  cleanup = mount(app);
}

async function init() {
  const handled = await handleAuthCallback();
  if (handled) window.location.hash = '#/lobby';
  window.addEventListener('hashchange', navigate);
  navigate();
}

init();
