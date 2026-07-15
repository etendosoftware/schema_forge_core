// No shebang: this module is a LIBRARY, imported both by the CLI wrapper
// (slice-labels-cli.js) and by consuming apps' build tooling (e.g. schema_forge's
// Vite plugin, via the `@etendosoftware/schema-forge-cli/slice-labels` export).
// esbuild rejects a shebang in an imported file, so the executable entry point
// lives in slice-labels-cli.js instead.
/**
 * slice-labels.js — build-time label slicer library (ETP-4300).
 *
 * Splits a set of monolithic locale dictionaries into:
 *   1. Per-window slices: <artifactsDir>/<win>/generated/web/<win>/labels.js
 *      — only the field labels that window's contract columns need, every locale,
 *        label-only (no `description`). Rides the window's existing lazy chunk.
 *   2. Shared core:        <generatedLocalesDir>/core.<locale>.json
 *      — the full dictionary minus `fields` (genericLabels/ui/menus/windows/tabs/statuses),
 *        loaded lazily for the active locale only.
 *
 * Pure transform over the consuming app's committed locale JSONs (NO DB access),
 * so it is fast and offline-safe.
 *
 * Path-agnostic: every IO entry point takes an explicit paths object
 * `{ localesDir, artifactsDir, generatedLocalesDir }` so this library carries no
 * assumption about the consuming app's directory layout. The CLI wrapper and the
 * Vite plugin each supply their own paths.
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SHARED_LABEL_COLUMNS } from './shared-label-columns.js';

/**
 * Windows that have a contract but never load as a standalone UI chunk
 * (consumed via fetch by other components). They must NOT get a labels.js,
 * and F18 must not flag them as missing. Mirrors registry.js `apiOnlyWindows`.
 */
const API_ONLY_WINDOWS = new Set([
  'sii-config', 'tbai-config', 'verifactu-config',
  'sii-monitor', 'monitor-verifactu', 'tbai-facturas-enviadas',
]);

// --- Pure helpers (exported for tests) ---

/** sha256 hex of a value, serialized canonically (sorted keys). */
export function sha256(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/** JSON.stringify with deterministically sorted object keys. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Collect every AD column referenced by a window's contract, across ALL entities
 * (header/lines is not guaranteed — e.g. `contacts` has 15 entities).
 * @returns {string[]} sorted, de-duplicated column names
 */
export function collectWindowColumns(contract) {
  const entities = contract?.frontendContract?.entities ?? {};
  const cols = new Set();
  for (const entity of Object.values(entities)) {
    for (const field of entity?.fields ?? []) {
      if (field?.column) cols.add(field.column);
    }
  }
  return [...cols].sort((a, b) => a.localeCompare(b));
}

/**
 * Columns that are actually rendered (form or grid). A missing label only hurts
 * the user for these — non-rendered columns (e.g. custom `EM_*` with form/grid
 * false) carry no user-visible label, so they must not trip the F18 warning.
 * @returns {Set<string>}
 */
export function collectRenderedColumns(contract) {
  const entities = contract?.frontendContract?.entities ?? {};
  const cols = new Set();
  for (const entity of Object.values(entities)) {
    for (const field of entity?.fields ?? []) {
      if (field?.column && (field.form || field.grid)) cols.add(field.column);
    }
  }
  return cols;
}

/**
 * Build the per-window label slice: { <locale>: { <column>: <label> } }.
 * Label-only (drops `description`). Columns absent from a locale's `fields`
 * are reported as missing and omitted (caller falls back to the raw AD label).
 * @returns {{ slice: object, missing: Record<string,string[]> }}
 */
export function sliceLabels(columns, dictsByLocale) {
  const slice = {};
  const missing = {};
  for (const [locale, dict] of Object.entries(dictsByLocale)) {
    const fields = dict?.fields ?? {};
    const out = {};
    const miss = [];
    for (const col of columns) {
      const label = fields[col]?.label;
      if (label != null && label !== '') out[col] = label;
      else miss.push(col);
    }
    slice[locale] = out;
    if (miss.length) missing[locale] = miss;
  }
  return { slice, missing };
}

/** Full dictionary minus the `fields` section (drops descriptions with it). */
export function buildCore(dict) {
  const { fields, ...core } = dict; // eslint-disable-line no-unused-vars
  return core;
}

/**
 * Label-only `fields` subset for the shared label set (ETP-4300): columns
 * referenced by a literal `t('<Column>')` in shared/cross-window components, which
 * per-window slices do not cover. Merged into `core.*` so they resolve everywhere.
 * Columns absent from the dictionary are skipped. See shared-label-columns.js.
 */
export function pickSharedLabels(fields = {}) {
  const out = {};
  for (const col of SHARED_LABEL_COLUMNS) {
    const label = fields[col]?.label;
    if (label != null && label !== '') out[col] = { label };
  }
  return out;
}

/** Render the generated labels.js module source for a window slice. */
export function labelsModuleSource(slice) {
  return [
    '// AUTO-GENERATED by @etendosoftware/schema-forge-cli (slice-labels) — do not edit.',
    '// Per-window field-label slice (ETP-4300). One entry per locale, label-only.',
    `export default ${JSON.stringify(slice, null, 2)};`,
    '',
  ].join('\n');
}

/** Checksum binding a window's columns to their label text across locales. */
export function labelsChecksum(columns, slice) {
  return sha256({ columns: [...columns].sort((a, b) => a.localeCompare(b)), slice });
}

// --- IO (path-agnostic: every entry point takes explicit dirs) ---

/** Discover locale codes (e.g. en_US) from top-level *.json in the locales dir. */
export async function loadLocales(localesDir) {
  const entries = await readdir(localesDir, { withFileTypes: true });
  const codes = entries
    .filter(e => e.isFile() && /^[a-z]{2}_[A-Z]{2}\.json$/.test(e.name))
    .map(e => e.name.replace(/\.json$/, ''))
    .sort((a, b) => a.localeCompare(b));
  const dicts = {};
  for (const code of codes) {
    dicts[code] = JSON.parse(await readFile(join(localesDir, `${code}.json`), 'utf-8'));
  }
  return { codes, dicts };
}

async function readContract(artifactsDir, name) {
  return JSON.parse(await readFile(join(artifactsDir, name, 'contract.json'), 'utf-8'));
}

function windowGeneratedDir(artifactsDir, name) {
  return join(artifactsDir, name, 'generated', 'web', name);
}

/**
 * Slice one window. Returns a summary object. Writes nothing when dryRun.
 *
 * Emits only `labels.js` — the slice is a build-time artifact (gitignored),
 * regenerated on every build, so there is no committed slice to go stale and no
 * manifest checksum to maintain. F18 validates by reproducing and comparing the
 * slice content directly (not via a stored checksum).
 */
export async function sliceWindow(name, dicts, { artifactsDir, dryRun = false }) {
  const contract = await readContract(artifactsDir, name);
  const columns = collectWindowColumns(contract);
  const rendered = collectRenderedColumns(contract);
  const { slice, missing } = sliceLabels(columns, dicts);

  // A missing label only matters for rendered columns — that is the F18 signal.
  const missingRendered = {};
  for (const [locale, cols] of Object.entries(missing)) {
    const hit = cols.filter(c => rendered.has(c));
    if (hit.length) missingRendered[locale] = hit;
  }

  if (!dryRun) {
    const dir = windowGeneratedDir(artifactsDir, name);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'labels.js'), labelsModuleSource(slice), 'utf-8');
  }
  return { name, columns: columns.length, missing, missingRendered, slice };
}

/** Emit core.<locale>.json for every locale. Writes nothing when dryRun. */
export async function emitCore(dicts, { generatedLocalesDir, dryRun = false }) {
  const result = {};
  if (!dryRun) await mkdir(generatedLocalesDir, { recursive: true });
  for (const [locale, dict] of Object.entries(dicts)) {
    // core = full dictionary minus `fields`, plus the shared-label `fields` subset
    // so cross-window components keep their labels once the monolith leaves the bundle.
    const core = { ...buildCore(dict), fields: pickSharedLabels(dict.fields) };
    const checksum = sha256(core);
    if (!dryRun) {
      await writeFile(
        join(generatedLocalesDir, `core.${locale}.json`),
        JSON.stringify(core, null, 2) + '\n',
        'utf-8',
      );
    }
    result[locale] = { bytes: stableStringify(core).length, checksum };
  }
  return result;
}

/** List window artifact names that have a contract.json (excludes API-only). */
export async function listWindows(artifactsDir) {
  const entries = await readdir(artifactsDir, { withFileTypes: true });
  const names = [];
  for (const e of entries) {
    if (!e.isDirectory() || API_ONLY_WINDOWS.has(e.name)) continue;
    try {
      await readFile(join(artifactsDir, e.name, 'contract.json'));
      names.push(e.name);
    } catch {
      // no contract → not a window artifact
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
}

/**
 * Slice every window + emit the shared core. Programmatic entry point for a
 * consuming app's build prebuild (e.g. schema_forge's Vite plugin) — loads locales
 * once, writes each window's labels.js and the core.<locale>.json. Pure transform,
 * no DB.
 * @param {{localesDir: string, artifactsDir: string, generatedLocalesDir: string}} paths
 * @returns {Promise<{windows: number, locales: string[]}>}
 */
export async function sliceAll({ localesDir, artifactsDir, generatedLocalesDir }) {
  const { codes, dicts } = await loadLocales(localesDir);
  const windows = await listWindows(artifactsDir);
  for (const name of windows) {
    await sliceWindow(name, dicts, { artifactsDir });
  }
  await emitCore(dicts, { generatedLocalesDir });
  return { windows: windows.length, locales: codes };
}
