import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/socket.io': { target: 'ws://localhost:3001', ws: true },
      '/api': 'http://localhost:3001',
    },
  },
});
