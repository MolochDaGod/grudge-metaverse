import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_METAVERSE_GLBS = path.resolve(__dirname, '../ObjectStore/models/grudge6/metaverse');
const VIEWER_PUBLIC = path.resolve(
  'C:/Users/nugye/Documents/Character-Animator-two/Character-Animator-two/artifacts/character-viewer/public',
);

function serveStaticFile(res: import('http').ServerResponse, file: string, contentType: string): void {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}

function serveLocalMetaverseAvatars(): Plugin {
  return {
    name: 'serve-local-metaverse-avatars',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url.startsWith('/models/grudge6/metaverse/')) {
          const file = path.join(LOCAL_METAVERSE_GLBS, path.basename(url));
          if (fs.existsSync(file)) {
            serveStaticFile(res, file, 'model/gltf-binary');
            return;
          }
        }
        if (url.startsWith('/assets/') && fs.existsSync(VIEWER_PUBLIC)) {
          const file = path.join(VIEWER_PUBLIC, url.slice(1));
          if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            const ext = path.extname(file).toLowerCase();
            const mime: Record<string, string> = {
              '.webp': 'image/webp',
              '.png': 'image/png',
              '.tga': 'application/octet-stream',
              '.jpg': 'image/jpeg',
            };
            serveStaticFile(res, file, mime[ext] ?? 'application/octet-stream');
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  build: { outDir: 'dist', target: 'esnext' },
  plugins: [serveLocalMetaverseAvatars()],
  server: {
    proxy: {
      '/api/auth/session/exchange': {
        target: 'https://api.grudge-studio.com',
        changeOrigin: true,
      },
      '/api/auth/puter': {
        target: 'https://grudge-builder-production.up.railway.app',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
          });
        },
      },
      '/api/auth': {
        target: 'https://id.grudge-studio.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, '/auth'),
      },
      '/api/characters': {
        target: 'https://grudge-builder-production.up.railway.app',
        changeOrigin: true,
      },
      '/api': {
        target: 'https://api.grudge-studio.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});