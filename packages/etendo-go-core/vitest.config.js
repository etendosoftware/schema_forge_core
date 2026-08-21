import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Component-level tests for this package. The `npm test` script stays on
// `node --test` for the pure-JS modules; anything that has to render a .jsx
// component runs here instead. See ETP-4959.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/vitest-setup.js'],
    include: ['src/**/*.vitest.{js,jsx}'],
  },
});
