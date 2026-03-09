import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import schemaApiPlugin from './vite-plugins/schema-api.js';

export default defineConfig({
  base: './',
  plugins: [react(), schemaApiPlugin()],
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
    },
  },
});
