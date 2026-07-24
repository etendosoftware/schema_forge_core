import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { QUERIES } from '../src/extract-from-db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/**
 * Regression guard for the extractor ORDER BY determinism fix (ETP-4603 /
 * commit 6a2e79305). Two invariants:
 *
 *   A — Total-order tiebreaker: every ORDER BY must contain a unique / PK
 *       column so the row order is total. Without it, per-DB cache snapshots
 *       are non-deterministic across runs.
 *   B — COLLATE "C": text sort columns in the specifically-fixed queries must
 *       carry COLLATE "C" so the option/row order is identical across DBs with
 *       different lc_collate (e.g. C vs es_ES.UTF-8). Intentionally-plain
 *       queries must NOT carry COLLATE — asserting it there would be wrong.
 *
 * These are STATIC assertions on the SQL strings — no DB access.
 */

// Matches an id / PK column token (e.g. ad_field_id, AD_Callout_ID,
// AD_AuxiliarInput_ID, process_id, AD_Val_Rule_ID, AD_Ref_List_ID).
const ID_COLUMN = /_id\b/i;

/** Returns the ORDER BY clause (everything after the final `ORDER BY`). */
function orderByClause(sql) {
  const idx = sql.toUpperCase().lastIndexOf('ORDER BY');
  assert.notEqual(idx, -1, 'query must have an ORDER BY clause');
  return sql.slice(idx + 'ORDER BY'.length).trim();
}

/** Splits an ORDER BY clause into its individual sort keys. */
function sortKeys(clause) {
  return clause.split(',').map((k) => k.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// extract-from-db.js — exported QUERIES
// ---------------------------------------------------------------------------

describe('ORDER BY determinism — QUERIES (extract-from-db.js)', () => {
  // --- Invariant A: total order via a unique / PK column ---

  describe('Invariant A — total-order tiebreaker', () => {
    for (const [name, sql] of Object.entries(QUERIES)) {
      it(`${name}: ORDER BY contains a unique/PK id column`, () => {
        const clause = orderByClause(sql);
        assert.match(
          clause,
          ID_COLUMN,
          `${name} ORDER BY must include a unique/PK id column for total order`
        );
      });
    }

    // Every query is anchored by a unique/PK id column at a stable position:
    // either tie-broken by a trailing id (fields, display-logic,
    // document-processes, auxiliary-inputs, ad-tabs, ad-columns) or led by its
    // PK (callouts → AD_Callout_ID, validation-rules → AD_Val_Rule_ID). Both
    // strategies yield a total order.
    for (const [name, sql] of Object.entries(QUERIES)) {
      it(`${name}: first or last sort key is a unique/PK id column`, () => {
        const keys = sortKeys(orderByClause(sql));
        const first = keys[0];
        const last = keys[keys.length - 1];
        assert.ok(
          ID_COLUMN.test(first) || ID_COLUMN.test(last),
          `${name} must be anchored by a unique/PK id column ` +
            `(first="${first}", last="${last}")`
        );
      });
    }

    it('validation-rules is led by its PK column', () => {
      const keys = sortKeys(orderByClause(QUERIES['validation-rules']));
      assert.match(
        keys[0],
        /AD_Val_Rule_ID/,
        'validation-rules must be led by AD_Val_Rule_ID'
      );
    });

    it('callouts is led by its PK column', () => {
      const keys = sortKeys(orderByClause(QUERIES.callouts));
      assert.match(
        keys[0],
        /AD_Callout_ID/,
        'callouts must be led by AD_Callout_ID'
      );
    });
  });

  // --- Invariant B: COLLATE "C" on the specifically-fixed queries ---

  describe('Invariant B — COLLATE "C" on fixed queries', () => {
    it('fields: text + tiebreaker columns carry COLLATE "C"', () => {
      const clause = orderByClause(QUERIES.fields);
      for (const token of [
        'tab_name COLLATE "C"',
        'AD_Tab_ID COLLATE "C"',
        'ColumnName COLLATE "C"',
        'ad_field_id COLLATE "C"',
      ]) {
        assert.ok(clause.includes(token), `fields ORDER BY must include: ${token}`);
      }
    });

    it('callouts: text + PK columns carry COLLATE "C"', () => {
      const clause = orderByClause(QUERIES.callouts);
      for (const token of [
        'co.AD_Callout_ID COLLATE "C"',
        'col.AD_Table_ID COLLATE "C"',
        'col.ColumnName COLLATE "C"',
      ]) {
        assert.ok(clause.includes(token), `callouts ORDER BY must include: ${token}`);
      }
    });

    it('display-logic: text + PK columns carry COLLATE "C"', () => {
      const clause = orderByClause(QUERIES['display-logic']);
      for (const token of [
        'c.ColumnName COLLATE "C"',
        'f.Name COLLATE "C"',
        'f.AD_Field_ID COLLATE "C"',
      ]) {
        assert.ok(clause.includes(token), `display-logic ORDER BY must include: ${token}`);
      }
    });

    it('document-processes: all sort columns carry COLLATE "C"', () => {
      const clause = orderByClause(QUERIES['document-processes']);
      for (const token of [
        'mechanism COLLATE "C"',
        'name COLLATE "C"',
        'column_name COLLATE "C"',
        'process_id COLLATE "C"',
        'obuiapp_process_id COLLATE "C"',
      ]) {
        assert.ok(clause.includes(token), `document-processes ORDER BY must include: ${token}`);
      }
    });

    // Intentionally-plain queries must NOT carry COLLATE (design guard).
    const PLAIN = [
      'validation-rules',
      'auxiliary-inputs',
      'ad-tabs-for-window',
      'ad-columns-for-window',
    ];
    for (const name of PLAIN) {
      it(`${name}: ORDER BY is intentionally plain (no COLLATE)`, () => {
        const clause = orderByClause(QUERIES[name]);
        assert.doesNotMatch(
          clause,
          /COLLATE/,
          `${name} ORDER BY must stay plain (coupled to seqno/PK ordering)`
        );
      });
    }
  });
});

// ---------------------------------------------------------------------------
// extract-fields.js — inline SQL (read source as text)
// ---------------------------------------------------------------------------

describe('ORDER BY determinism — extract-fields.js (inline SQL)', () => {
  it('orphan-columns query and ref-list query carry COLLATE "C" + id tiebreaker', async () => {
    const src = await readFile(join(ROOT, 'src', 'extract-fields.js'), 'utf-8');

    // Orphan columns (columns with no AD_Field) — fixed ORDER BY.
    for (const token of [
      't.Name COLLATE "C"',
      't.AD_Tab_ID COLLATE "C"',
      'c.ColumnName COLLATE "C"',
      'c.AD_Column_ID COLLATE "C"',
    ]) {
      assert.ok(src.includes(token), `extract-fields.js must include: ${token}`);
    }

    // Ref-list (enum options) — fixed ORDER BY.
    for (const token of [
      'rl.Name COLLATE "C"',
      'rl.Value COLLATE "C"',
      'rl.AD_Reference_ID COLLATE "C"',
      'rl.AD_Ref_List_ID COLLATE "C"',
    ]) {
      assert.ok(src.includes(token), `extract-fields.js must include: ${token}`);
    }
  });
});

// ---------------------------------------------------------------------------
// extract-rules.js — inline SQL (read source as text)
// ---------------------------------------------------------------------------

describe('ORDER BY determinism — extract-rules.js (inline SQL)', () => {
  it('callouts and document-processes queries carry COLLATE "C" + id tiebreaker', async () => {
    const src = await readFile(join(ROOT, 'src', 'extract-rules.js'), 'utf-8');

    // Callouts — fixed ORDER BY.
    for (const token of [
      'co.AD_Callout_ID COLLATE "C"',
      'col.AD_Table_ID COLLATE "C"',
      'col.ColumnName COLLATE "C"',
    ]) {
      assert.ok(src.includes(token), `extract-rules.js must include: ${token}`);
    }

    // Document processes — fixed ORDER BY.
    for (const token of [
      'mechanism COLLATE "C"',
      'name COLLATE "C"',
      'column_name COLLATE "C"',
      'process_id COLLATE "C"',
      'obuiapp_process_id COLLATE "C"',
    ]) {
      assert.ok(src.includes(token), `extract-rules.js must include: ${token}`);
    }
  });
});
