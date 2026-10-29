import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const server = process.env.DEV_SERVER_URL ?? 'http://127.0.0.1:3101';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': server,
      '/ws': { target: server, ws: true },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
});
