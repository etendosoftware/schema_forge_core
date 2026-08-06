#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createDbPool, closePool } from './db.js';
import { buildEnumLabelKey } from './enum-label-key.js';

const QUERIES = {
  fields: `
SELECT
  c.columnname AS column_key,
  COALESCE(ft.name, f.name) AS label,
  COALESCE(et.description, e.description) AS description
FROM ad_field f
JOIN ad_column c ON f.ad_column_id = c.ad_column_id
JOIN ad_element e ON c.ad_element_id = e.ad_element_id
LEFT JOIN ad_field_trl ft ON f.ad_field_id = ft.ad_field_id AND ft.ad_language = $1
LEFT JOIN ad_element_trl et ON e.ad_element_id = et.ad_element_id AND et.ad_language = $1
WHERE f.isactive = 'Y'`,

  windows: `
SELECT w.name AS key, COALESCE(wt.name, w.name) AS label
FROM ad_window w
LEFT JOIN ad_window_trl wt ON w.ad_window_id = wt.ad_window_id AND wt.ad_language = $1
WHERE w.isactive = 'Y'`,

  tabs: `
SELECT t.name AS key, COALESCE(tt.name, t.name) AS label
FROM ad_tab t
LEFT JOIN ad_tab_trl tt ON t.ad_tab_id = tt.ad_tab_id AND tt.ad_language = $1
WHERE t.isactive = 'Y'`,

  menus: `
SELECT m.name AS key, COALESCE(mt.name, m.name) AS label
FROM ad_menu m
LEFT JOIN ad_menu_trl mt ON m.ad_menu_id = mt.ad_menu_id AND mt.ad_language = $1
WHERE m.isactive = 'Y'`,

  // Document and payment status codes used by statusBadge.js.
  // DISTINCT ON ensures one row per value code when the same code appears in multiple references.
  statuses: `
SELECT DISTINCT ON (rl.value)
  rl.value AS key,
  COALESCE(rlt.name, rl.name) AS label
FROM ad_ref_list rl
LEFT JOIN ad_ref_list_trl rlt
  ON rl.ad_ref_list_id = rlt.ad_ref_list_id AND rlt.ad_language = $1
WHERE rl.value IN (
  'DR', 'CO', 'VO', 'IP', 'CL', 'PA', 'UE', 'CA', 'CJ',
  'RPR', 'RPAE', 'RPAP', 'RPPC', 'RPVOID',
  'PPM', 'PWNC', 'RDNC',
  'ETGO_CI'
)
AND rl.isactive = 'Y'
ORDER BY rl.value, rlt.name NULLS LAST`,

  // ETP-4685 — translations for List-reference (AD_Ref_List) values used as
  // enumLabels in generated grid/filter columns. Unlike `statuses` above, this
  // is NOT restricted to a whitelist: every List column's values are covered,
  // scoped by column name (via buildEnumLabelKey) to avoid collisions between
  // unrelated reference lists that happen to share a short Value code. Keyed
  // by rl.value (stable, language-independent — matches the `statuses`
  // convention above), never by rl.name, which is a mutable display label.
  enumLabels: `
SELECT DISTINCT ON (c.columnname, rl.value)
  c.columnname AS column_name,
  rl.value AS value,
  COALESCE(rlt.name, rl.name) AS label
FROM ad_column c
JOIN ad_ref_list rl ON rl.ad_reference_id = c.ad_reference_value_id
LEFT JOIN ad_ref_list_trl rlt
  ON rl.ad_ref_list_id = rlt.ad_ref_list_id AND rlt.ad_language = $1
WHERE c.ad_reference_id = '17'
  AND c.isactive = 'Y'
  AND rl.isactive = 'Y'
ORDER BY c.columnname, rl.value, rl.name COLLATE "C"`,
};

/**
 * Deduplicate field rows by column_key.
 * When multiple ad_field rows exist for the same column (from different windows),
 * prefer the one where the field label differs from the element fallback — meaning
 * a field-level override exists. If all are the same, just take the first.
 */
function deduplicateFields(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.column_key;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  const result = {};
  for (const [key, entries] of groups) {
    // Pick the first entry — they are all valid; field-level names are already
    // resolved via COALESCE in the query (field name wins over element name).
    const picked = entries[0];
    result[key] = {
      label: picked.label || '',
      description: picked.description || '',
    };
  }
  return result;
}

/**
 * Build a simple key->label map from rows with key and label columns.
 */
function buildKeyLabelMap(rows) {
  const result = {};
  for (const row of rows) {
    // Last-write-wins for duplicates (same name from different records)
    result[row.key] = { label: row.label || '' };
  }
  return result;
}

/**
 * Build a key->label map for List-reference (AD_Ref_List) values, keyed by a
 * column-scoped i18n key (see buildEnumLabelKey) instead of the raw Value
 * code — avoids collisions between unrelated lists sharing a short code.
 */
function buildEnumLabelMap(rows) {
  const result = {};
  for (const row of rows) {
    const key = buildEnumLabelKey(row.column_name, row.value);
    // Last-write-wins for duplicates, consistent with buildKeyLabelMap.
    result[key] = { label: row.label || '' };
  }
  return result;
}

/**
 * Extract labels from the database for the given language.
 * Accepts a pool (or pool-like object with a query method) for testability.
 */
export async function extractLabels(pool, lang) {
  const [fieldsRes, windowsRes, tabsRes, menusRes, statusesRes, enumLabelsRes] = await Promise.all([
    pool.query(QUERIES.fields, [lang]),
    pool.query(QUERIES.windows, [lang]),
    pool.query(QUERIES.tabs, [lang]),
    pool.query(QUERIES.menus, [lang]),
    pool.query(QUERIES.statuses, [lang]),
    pool.query(QUERIES.enumLabels, [lang]),
  ]);

  return {
    fields: deduplicateFields(fieldsRes.rows),
    windows: buildKeyLabelMap(windowsRes.rows),
    tabs: buildKeyLabelMap(tabsRes.rows),
    menus: buildKeyLabelMap(menusRes.rows),
    statuses: buildKeyLabelMap(statusesRes.rows),
    enumLabels: buildEnumLabelMap(enumLabelsRes.rows),
  };
}

/**
 * Merge freshly extracted labels into an existing locale file's contents.
 * `enumLabels` is nested into `genericLabels` (keyed by its i18n key, valued
 * by its translated label text) instead of becoming its own top-level
 * section — this is what useUI()/ui() actually reads (see ETP-4685). Other
 * hand-maintained genericLabels entries are preserved; only the extracted
 * enum keys are added/overwritten.
 */
export function mergeLocaleFile(existing, labels) {
  const base = existing || {};
  const { enumLabels, ...rest } = labels;
  const enumEntries = Object.fromEntries(
    Object.entries(enumLabels || {}).map(([key, entry]) => [key, entry.label]),
  );
  return {
    ...base,
    ...rest,
    genericLabels: { ...(base.genericLabels || {}), ...enumEntries },
  };
}

// --- CLI ---

function parseArgs(argv) {
  const args = argv.slice(2);
  let lang = null;
  let out = null;

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--lang' && args[i + 1]) {
      lang = args[i + 1];
      i += 2;
    } else if (args[i] === '--out' && args[i + 1]) {
      out = args[i + 1];
      i += 2;
    } else {
      i += 1;
    }
  }
  return { lang, out };
}

async function main() {
  const { lang, out } = parseArgs(process.argv);

  if (!lang || !out) {
    console.error('Usage: node extract-labels.js --lang <language> --out <path>');
    console.error('Example: node cli/src/extract-labels.js --lang en_US --out packages/app-shell-core/src/locales/en_US.json');
    process.exit(1);
  }

  const pool = createDbPool();
  try {
    const labels = await extractLabels(pool, lang);

    const fieldCount = Object.keys(labels.fields).length;
    const windowCount = Object.keys(labels.windows).length;
    const tabCount = Object.keys(labels.tabs).length;
    const menuCount = Object.keys(labels.menus).length;
    const statusCount = Object.keys(labels.statuses).length;
    const enumLabelCount = Object.keys(labels.enumLabels).length;

    console.log(`Extracted labels for "${lang}":`);
    console.log(`  fields:      ${fieldCount}`);
    console.log(`  windows:     ${windowCount}`);
    console.log(`  tabs:        ${tabCount}`);
    console.log(`  menus:       ${menuCount}`);
    console.log(`  statuses:    ${statusCount}`);
    console.log(`  enumLabels:  ${enumLabelCount} (merged into genericLabels)`);

    // Merge with existing file to preserve non-extracted sections (e.g. genericLabels, ui)
    await mkdir(dirname(out), { recursive: true });
    let existing = null;
    try {
      existing = JSON.parse(await readFile(out, 'utf-8'));
      const preserved = Object.keys(existing).filter(k => !(k in labels) && k !== 'genericLabels');
      if (preserved.length) {
        console.log(`  preserved: ${preserved.join(', ')}`);
      }
    } catch {
      // File doesn't exist yet — write fresh
    }
    const merged = mergeLocaleFile(existing, labels);
    await writeFile(out, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    console.log(`\nWritten to ${out}`);
  } finally {
    await closePool(pool);
  }
}

// Only run CLI when executed directly (not imported)
const isMain = process.argv[1] && (
  process.argv[1].endsWith('extract-labels.js') ||
  process.argv[1].endsWith('extract-labels')
);

if (isMain) {
  main().catch((err) => {
    console.error('Label extraction failed:', err.message);
    process.exit(1);
  });
}
