import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './pwa/swPlugin';

export default defineConfig({
  // serviceWorkerPlugin is `apply: 'build'`: the dev server never emits or serves a worker.
  plugins: [react(), tailwindcss(), serviceWorkerPlugin()],
  server: {
    proxy: {
      '/socket.io': { target: 'ws://localhost:3001', ws: true },
      '/api': 'http://localhost:3001',
    },
  },
});
