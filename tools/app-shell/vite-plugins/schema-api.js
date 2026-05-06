import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const ARTIFACTS_DIR = resolve(import.meta.dirname, '../../../artifacts');
const REPO_ROOT = resolve(ARTIFACTS_DIR, '..');

const SAFE_WINDOW_RE = /^[a-z0-9-]+$/;
const SAFE_REF_RE = /^[a-f0-9]{7,40}$/;
const ALLOWED_ARTIFACT_FILES = ['schema-raw.json', 'schema-curated.json', 'contract.json'];

/**
 * Vite plugin that exposes REST endpoints for the Artifact Viewer
 * and the Source Viewer (raw generated JSX preview).
 *
 *   GET  /api/artifacts                 — list windows with artifact files
 *   GET  /api/artifacts/:window/history — git history for a window's files
 *   GET  /api/artifacts/:window/:file   — read artifact file (optional ?ref= for git version)
 *   GET  /api/source/:window/:file      — raw text of a generated .jsx file
 */
export default function schemaApiPlugin() {
  return {
    name: 'schema-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathname = parsedUrl.pathname;

        // GET /api/source/:window/:file
        const sourceMatch = pathname.match(/^\/api\/source\/([^/]+)\/([^/]+)$/);
        if (sourceMatch && req.method === 'GET') {
          const [, windowName, fileName] = sourceMatch;
          if (!SAFE_WINDOW_RE.test(windowName) || !/^[A-Za-z0-9_-]+\.jsx$/.test(fileName)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid parameters' }));
            return;
          }
          try {
            const filePath = join(ARTIFACTS_DIR, windowName, 'generated', 'web', windowName, fileName);
            const data = readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'text/plain');
            res.end(data);
          } catch (err) {
            res.statusCode = err.code === 'ENOENT' ? 404 : 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // GET /api/artifacts (list windows)
        if (pathname === '/api/artifacts' && req.method === 'GET') {
          return handleListArtifacts(res);
        }

        // GET /api/artifacts/:window/history
        const historyMatch = pathname.match(/^\/api\/artifacts\/([^/]+)\/history$/);
        if (historyMatch && req.method === 'GET') {
          const windowName = historyMatch[1];
          if (!SAFE_WINDOW_RE.test(windowName)) {
            return sendError(res, 400, 'Invalid window name');
          }
          return handleArtifactHistory(res, windowName);
        }

        // GET /api/artifacts/:window/:file?ref=hash
        const fileMatch = pathname.match(/^\/api\/artifacts\/([^/]+)\/([^/]+)$/);
        if (fileMatch && req.method === 'GET') {
          const windowName = fileMatch[1];
          const fileName = fileMatch[2];
          if (!SAFE_WINDOW_RE.test(windowName)) {
            return sendError(res, 400, 'Invalid window name');
          }
          if (!ALLOWED_ARTIFACT_FILES.includes(fileName)) {
            return sendError(res, 400, 'File not allowed. Must be one of: ' + ALLOWED_ARTIFACT_FILES.join(', '));
          }
          const ref = parsedUrl.searchParams.get('ref') || null;
          if (ref && !SAFE_REF_RE.test(ref)) {
            return sendError(res, 400, 'Invalid git ref format');
          }
          return handleArtifactFile(res, windowName, fileName, ref);
        }

        next();
      });
    },
  };
}

function sendError(res, status, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}

/** List all windows that have at least one of the 3 artifact files. */
function handleListArtifacts(res) {
  try {
    const entries = readdirSync(ARTIFACTS_DIR, { withFileTypes: true });
    const windows = entries
      .filter((e) => e.isDirectory())
      .filter((e) => {
        const dir = join(ARTIFACTS_DIR, e.name);
        return ALLOWED_ARTIFACT_FILES.some((f) => existsSync(join(dir, f)));
      })
      .map((e) => e.name)
      .sort();

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ windows }));
  } catch (err) {
    sendError(res, 500, err.message);
  }
}

/** Git history for a window's artifact files (last 50 commits). */
function handleArtifactHistory(res, windowName) {
  try {
    const filePaths = ALLOWED_ARTIFACT_FILES.map(
      (f) => `artifacts/${windowName}/${f}`
    ).join(' ');

    const cmd = `git log -50 --pretty=format:'%h||%ci||%s' --follow -- ${filePaths}`;
    const output = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 10000 });

    const commits = output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [hash, date, ...subjectParts] = line.split('||');
        return { hash, date, subject: subjectParts.join('||') };
      });

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ commits }));
  } catch (err) {
    sendError(res, 500, err.message);
  }
}

/** Read an artifact file, optionally at a specific git ref. */
function handleArtifactFile(res, windowName, fileName, ref) {
  try {
    let data;
    if (ref) {
      const gitPath = `artifacts/${windowName}/${fileName}`;
      const cmd = `git show ${ref}:${gitPath}`;
      data = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 10000 });
    } else {
      const filePath = join(ARTIFACTS_DIR, windowName, fileName);
      data = readFileSync(filePath, 'utf-8');
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT' || (err.stderr && err.stderr.includes('does not exist'))) {
      sendError(res, 404, 'File not found at this version');
    } else {
      sendError(res, 500, err.message);
    }
  }
}
