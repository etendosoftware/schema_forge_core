import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Quick-order gets port N=1 per the SDK port allocation convention:
//   Vite UI: 5173 + 1 = 5174
//   BFF:     4100 + 1 = 4101
// See docs/proposals/etendo-apps-sdk.md §14.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:4101', changeOrigin: true },
    },
  },
});
