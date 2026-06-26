/**
 * Grudge Metaverse — Main entry point with hash-based router.
 * #/game → Character-Animator-two grudge-game /world
 * #/test, #/play → GrudgeBuilder Island3DEngine pirate-islands lobby
 */

import { handleAuthCallback } from './lib/auth';
import { mountLanding } from './pages/landing';
import { mountLobby } from './pages/lobby';
import { mountGame } from './pages/game';
import { mountTest } from './pages/test';
import { mountPlay } from './pages/play';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

type Route = '/' | '/lobby' | '/game' | '/test' | '/play';

const routes: Record<Route, (container: HTMLElement) => () => void> = {
  '/': mountLanding,
  '/lobby': mountLobby,
  '/game': mountGame,
  '/test': mountTest,
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
  // Path-based /test (metaverse.grudge-studio.com/test or test.* alias)
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/test' && !window.location.hash) {
    window.location.replace(`${window.location.origin}/#/test${window.location.search}`);
    return;
  }

  const handled = await handleAuthCallback();
  if (handled) window.location.hash = '#/lobby';
  window.addEventListener('hashchange', navigate);
  navigate();
}

init();
