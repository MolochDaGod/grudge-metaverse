import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', target: 'esnext' },
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
