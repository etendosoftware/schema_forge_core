import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.vitest.{js,jsx}', 'src/**/*.spec.{js,jsx}'],
    css: false,
    alias: {
      '@': resolve(__dirname, './src'),
      '@generated': resolve(__dirname, '../../artifacts'),
    },
    // @exodus/bytes ≥1.14 ships pure ESM; html-encoding-sniffer (jsdom dep) does require() on it.
    // Node 22 flag lets CJS require() synchronous ESM so the coverage forks pool can load jsdom.
    execArgv: ['--experimental-require-module'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: resolve(__dirname, 'coverage/vitest'),
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/test/**',
        'node_modules/**',
      ],
    },
  },
});
