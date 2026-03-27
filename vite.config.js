import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 2427,
    proxy: {
      '/api': {
        target: 'http://localhost:2426',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:2426',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
