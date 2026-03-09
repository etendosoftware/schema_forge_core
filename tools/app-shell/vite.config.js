import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@generated': resolve(__dirname, '../../artifacts'),
    },
  },
  server: {
    port: 3100,
    proxy: {
      '/etendo_sf': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/sws': {
        target: 'http://localhost:8080/etendo',
        changeOrigin: true,
      },
      '/webhooks': {
        target: 'http://localhost:8080/etendo',
        changeOrigin: true,
      },
    },
  },
});
