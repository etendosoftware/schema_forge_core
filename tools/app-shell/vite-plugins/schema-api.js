import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ARTIFACTS_DIR = resolve(import.meta.dirname, '../../../artifacts');
const CONTRACT_GENERATOR = resolve(import.meta.dirname, '../../../cli/src/generate-contract.js');
const FRONTEND_GENERATOR = resolve(import.meta.dirname, '../../../cli/src/generate-frontend.js');

/**
 * Vite plugin that exposes REST endpoints for the Schema Inspector.
 *
 * GET  /api/schema/:window      — read schema-curated.json
 * GET  /api/schema-raw/:window  — read schema-raw.json
 * POST /api/schema/:window      — write schema, regenerate contract + frontend
 */
export default function schemaApiPlugin() {
  return {
    name: 'schema-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // GET /api/schema-raw/:window
        const rawMatch = req.url?.match(/^\/api\/schema-raw\/([^/?]+)/);
        if (rawMatch && req.method === 'GET') {
          return serveJson(res, rawMatch[1], 'schema-raw.json');
        }

        // GET /api/schema/:window
        const getMatch = req.url?.match(/^\/api\/schema\/([^/?]+)/);
        if (getMatch && req.method === 'GET') {
          return serveJson(res, getMatch[1], 'schema-curated.json');
        }

        // POST /api/schema/:window
        const postMatch = req.url?.match(/^\/api\/schema\/([^/?]+)/);
        if (postMatch && req.method === 'POST') {
          return handlePost(req, res, postMatch[1]);
        }

        next();
      });
    },
  };
}

function serveJson(res, window, filename) {
  try {
    const filePath = join(ARTIFACTS_DIR, window, filename);
    const data = readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.end(data);
  } catch (err) {
    res.statusCode = err.code === 'ENOENT' ? 404 : 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handlePost(req, res, window) {
  const start = performance.now();

  try {
    const body = await readBody(req);
    const { schema } = JSON.parse(body);

    if (!schema) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing "schema" in request body' }));
      return;
    }

    const windowDir = join(ARTIFACTS_DIR, window);
    mkdirSync(windowDir, { recursive: true });

    // 1. Write schema-curated.json
    const schemaPath = join(windowDir, 'schema-curated.json');
    writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

    // 2. Generate contract
    const { generateContract } = await import(CONTRACT_GENERATOR);
    const contract = generateContract(schema);
    const contractPath = join(windowDir, 'contract.json');
    writeFileSync(contractPath, JSON.stringify(contract, null, 2));

    // 3. Generate frontend files
    const { generateAll } = await import(FRONTEND_GENERATOR);
    const files = generateAll(contract);
    const webDir = join(windowDir, 'generated', 'web', window);
    mkdirSync(webDir, { recursive: true });

    const writtenFiles = [];
    for (const [filename, code] of Object.entries(files)) {
      const filePath = join(webDir, filename);
      writeFileSync(filePath, code);
      writtenFiles.push(filename);
    }

    const duration = ((performance.now() - start) / 1000).toFixed(1);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      regenerated: true,
      duration: `${duration}s`,
      files: writtenFiles,
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
