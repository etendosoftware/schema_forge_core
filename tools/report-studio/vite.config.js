import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');

function localFileServer() {
  return {
    name: 'local-file-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // List artifacts that have report-contract.json
        if (req.url === '/api/artifacts') {
          try {
            const artifactsDir = join(ROOT, 'artifacts');
            const dirs = readdirSync(artifactsDir).filter(d => {
              const contractPath = join(artifactsDir, d, 'report-contract.json');
              return existsSync(contractPath) && statSync(join(artifactsDir, d)).isDirectory();
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(dirs));
          } catch {
            res.setHeader('Content-Type', 'application/json');
            res.end('[]');
          }
          return;
        }

        // Serve files from artifacts/
        if (req.url.startsWith('/api/artifacts/')) {
          const relPath = req.url.replace('/api/artifacts/', '');
          const filePath = join(ROOT, 'artifacts', relPath);
          if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
            const content = readFileSync(filePath);
            const ext = filePath.split('.').pop();
            const mimeTypes = { json: 'application/json', hbs: 'text/plain', css: 'text/css', js: 'application/javascript', html: 'text/html' };
            res.setHeader('Content-Type', mimeTypes[ext] ?? 'application/octet-stream');
            res.end(content);
            return;
          }
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        // Serve files from templates/
        if (req.url.startsWith('/api/templates/')) {
          const relPath = req.url.replace('/api/templates/', '');
          const filePath = join(ROOT, 'templates', relPath);
          if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
            const content = readFileSync(filePath);
            const ext = filePath.split('.').pop();
            const mimeTypes = { json: 'application/json', hbs: 'text/plain', css: 'text/css', js: 'application/javascript' };
            res.setHeader('Content-Type', mimeTypes[ext] ?? 'application/octet-stream');
            res.end(content);
            return;
          }
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localFileServer()],
  server: {
    port: 3200,
    open: false,
    proxy: {
      '/api/report': {
        target: 'http://localhost:5488',
        changeOrigin: true,
      },
    },
  },
});
