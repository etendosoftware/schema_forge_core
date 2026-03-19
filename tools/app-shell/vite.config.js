import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import schemaApiPlugin from './vite-plugins/schema-api.js';
import reportApiPlugin from './vite-plugins/report-api.js';

// Target Etendo instance for dev proxy. Override via ETENDO_URL in .env.local
// if your instance uses a different context.name (e.g. ETENDO_URL=http://localhost:8080/mycontext)
const ETENDO_URL = process.env.ETENDO_URL || 'http://localhost:8080/etendo';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    schemaApiPlugin(),
    reportApiPlugin(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Etendo',
        short_name: 'Etendo',
        description: 'Etendo ERP',
        theme_color: '#1863DC',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
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
        target: ETENDO_URL,
        changeOrigin: true,
      },
      '/sws': {
        target: ETENDO_URL,
        changeOrigin: true,
      },
      '/webhooks': {
        target: ETENDO_URL,
        changeOrigin: true,
      },
      '/jsreport': {
        target: 'http://localhost:5488',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jsreport/, ''),
      },
    },
  },
});
