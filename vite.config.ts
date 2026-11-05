import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/clareza-demo/' : './',
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // No React refresh client: connect-src 'none' intentionally blocks HMR sockets.
  oxc: { jsx: { runtime: 'automatic' } },
  server: { host: '127.0.0.1', strictPort: true, port: 5187, hmr: false },
  preview: { host: '127.0.0.1', strictPort: true, port: 4187 },
  build: { sourcemap: false },
}));
