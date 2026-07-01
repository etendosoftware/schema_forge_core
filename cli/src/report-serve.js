#!/usr/bin/env node

/**
 * report-serve.js — Docker management tool for jsreport.
 *
 * Manages the jsreport Docker container used for PDF/report generation.
 *
 * Usage:
 *   node cli/src/report-serve.js                    # Start in foreground
 *   node cli/src/report-serve.js --detach           # Start in background
 *   node cli/src/report-serve.js --port 5500        # Custom port
 *   node cli/src/report-serve.js --stop             # Stop the container
 *   node cli/src/report-serve.js --verbose          # Verbose output
 */

import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');

const COMPOSE_DIR = join(ROOT, 'docker', 'jsreport');
const DEFAULT_PORT = 5488;

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Parse CLI arguments into an options object.
 * @param {string[]} argv - argument list (e.g. process.argv.slice(2))
 * @returns {{ port: number, verbose: boolean, detach: boolean, stop: boolean }}
 */
export function parseServeArgs(argv) {
  const opts = {
    port: DEFAULT_PORT,
    verbose: false,
    detach: false,
    stop: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) {
      opts.port = parseInt(argv[i + 1], 10);
      i += 2;
    } else if (arg === '--verbose') {
      opts.verbose = true;
      i += 1;
    } else if (arg === '--detach') {
      opts.detach = true;
      i += 1;
    } else if (arg === '--stop') {
      opts.stop = true;
      i += 1;
    } else {
      i += 1;
    }
  }

  return opts;
}

/**
 * Build the docker compose argument array for starting jsreport.
 * @param {{ port: number, detach: boolean, verbose: boolean }} opts
 * @returns {string[]}
 */
export function buildComposeArgs(opts) {
  const args = ['compose', 'up', '--build'];

  if (opts.detach) {
    args.push('-d');
  }

  return args;
}

/**
 * Build the jsreport health check URL.
 * @param {number} port
 * @returns {string}
 */
export function buildHealthCheckUrl(port) {
  return `http://localhost:${port}/api/ping`;
}

// ---------------------------------------------------------------------------
// Runtime logic (not unit-tested — uses child_process)
// ---------------------------------------------------------------------------

/**
 * Start or stop the jsreport Docker container.
 * @param {{ port: number, verbose: boolean, detach: boolean, stop: boolean }} opts
 */
export async function serve(opts) {
  const env = { ...process.env, JSREPORT_PORT: String(opts.port) };

  if (opts.stop) {
    if (opts.verbose) {
      console.log('[report-serve] Stopping jsreport container...');
    }
    execSync('docker compose down', {
      cwd: COMPOSE_DIR,
      env,
      stdio: opts.verbose ? 'inherit' : 'pipe',
    });
    console.log('[report-serve] jsreport stopped.');
    return;
  }

  if (opts.verbose) {
    console.log(`[report-serve] Starting jsreport on port ${opts.port}...`);
    console.log(`[report-serve] Compose dir: ${COMPOSE_DIR}`);
    console.log(`[report-serve] Health check: ${buildHealthCheckUrl(opts.port)}`);
  }

  const args = buildComposeArgs(opts);
  const child = spawn('docker', args, {
    cwd: COMPOSE_DIR,
    env,
    stdio: 'inherit',
    detached: opts.detach,
  });

  if (opts.detach) {
    child.unref();
    console.log(`[report-serve] jsreport started in background on port ${opts.port}.`);
    console.log(`[report-serve] Health check: ${buildHealthCheckUrl(opts.port)}`);
  } else {
    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`docker compose exited with code ${code}`));
      });
      child.on('error', reject);
    });
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const opts = parseServeArgs(process.argv.slice(2));
  serve(opts).catch((err) => {
    console.error('[report-serve] Error:', err.message);
    process.exit(1);
  });
}
