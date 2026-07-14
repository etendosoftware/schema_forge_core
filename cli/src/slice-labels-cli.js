#!/usr/bin/env node
/**
 * slice-labels-cli.js — executable entry point for the ETP-4300 label slicer.
 *
 * Thin wrapper around the path-agnostic library in ./slice-labels.js. Resolves the
 * consuming app's directories from CWD (overridable via flags), then slices every
 * window and emits the shared core.
 *
 * Usage (run from the consuming app root, e.g. schema_forge):
 *   sf-slice-labels --window sales-order              # slice one window + emit core
 *   sf-slice-labels --all                             # slice every active window + emit core
 *   sf-slice-labels --all --dry-run                   # preview, write nothing
 *   sf-slice-labels --all --check                     # fail if any committed slice is stale
 *   sf-slice-labels --all --locales-dir <dir> --artifacts-dir <dir>
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  emitCore,
  labelsModuleSource,
  listWindows,
  loadLocales,
  sliceWindow,
} from './slice-labels.js';

/** Default directories for the schema_forge app layout, resolved from CWD. */
function defaultPaths(cwd) {
  const localesDir = join(cwd, 'tools', 'app-shell', 'src', 'locales');
  return {
    localesDir,
    generatedLocalesDir: join(localesDir, 'generated'),
    artifactsDir: join(cwd, 'artifacts'),
  };
}

// Flags that consume the next argument as their value → target opts key.
const VALUE_FLAGS = {
  '--window': 'window',
  '--locales-dir': 'localesDir',
  '--artifacts-dir': 'artifactsDir',
  '--generated-locales-dir': 'generatedLocalesDir',
};

// Boolean flags → mutation applied to opts.
const BOOL_FLAGS = {
  '--all': (o) => { o.all = true; },
  '--no-core': (o) => { o.core = false; },
  '--dry-run': (o) => { o.dryRun = true; },
  '--check': (o) => { o.check = true; o.dryRun = true; },
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    window: null, all: false, core: true, dryRun: false, check: false, ...defaultPaths(process.cwd()),
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const valueKey = VALUE_FLAGS[arg];
    if (valueKey && args[i + 1] !== undefined) {
      opts[valueKey] = args[i + 1];
      i += 1;
    } else {
      BOOL_FLAGS[arg]?.(opts);
    }
  }
  return opts;
}

/** Build the `⚠ missing rendered label` note for one window (empty when none). */
function formatMissingRendered(missingRendered) {
  const parts = Object.entries(missingRendered).map(([locale, cols]) => `${locale}=${cols.join('/')}`);
  return parts.length ? ` | ⚠ missing rendered label: ${parts.join(', ')}` : '';
}

/**
 * Slice one window, log a one-line summary, and (under --check) report whether
 * the committed labels.js is stale or missing. Returns true when stale/missing.
 */
async function processWindow(name, dicts, opts) {
  const r = await sliceWindow(name, dicts, { artifactsDir: opts.artifactsDir, dryRun: opts.dryRun });
  console.log(`  ${r.name.padEnd(30)} ${String(r.columns).padStart(3)} cols${formatMissingRendered(r.missingRendered)}`);

  if (!opts.check) return false;
  let committed = null;
  try {
    committed = await readFile(join(opts.artifactsDir, name, 'generated', 'web', name, 'labels.js'), 'utf-8');
  } catch {
    // labels.js not committed — treated as stale/missing below.
  }
  const stale = committed == null || committed !== labelsModuleSource(r.slice);
  if (stale) console.error(`  ✗ STALE/MISSING slice: ${name}`);
  return stale;
}

/** Emit (or preview) core.<locale>.json and log a one-line summary per locale. */
async function emitAndReportCore(dicts, opts) {
  const core = await emitCore(dicts, { generatedLocalesDir: opts.generatedLocalesDir, dryRun: opts.dryRun });
  for (const [locale, info] of Object.entries(core)) {
    const kb = (info.bytes / 1024).toFixed(0);
    console.log(`  core.${locale}.json  ~${kb} KB  ${info.checksum.slice(0, 12)}…`);
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.window && !opts.all) {
    console.error('Usage: sf-slice-labels (--window <name> | --all) [--dry-run] [--check] [--no-core] [--locales-dir <dir>] [--artifacts-dir <dir>]');
    process.exit(1);
  }

  const { codes, dicts } = await loadLocales(opts.localesDir);
  console.log(`Locales: ${codes.join(', ')}`);

  const windows = opts.all ? await listWindows(opts.artifactsDir) : [opts.window];
  let staleOrMissing = 0;
  for (const name of windows) {
    if (await processWindow(name, dicts, opts)) staleOrMissing += 1;
  }

  if (opts.core) await emitAndReportCore(dicts, opts);

  if (opts.dryRun && !opts.check) console.log('\n(dry-run — nothing written)');
  if (opts.check && staleOrMissing) {
    console.error(`\n✗ ${staleOrMissing} window(s) have a stale/missing slice. Run the slicer to regenerate.`);
    process.exit(1);
  }
  if (!opts.dryRun) console.log('\nDone.');
}

main().catch((err) => {
  console.error('slice-labels failed:', err.message);
  process.exit(1);
});
