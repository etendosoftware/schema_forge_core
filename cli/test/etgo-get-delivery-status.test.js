import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { createDbPool } from '../src/db.js';

// Integration test for etgo_get_delivery_status(c_invoice_id).
// The function powers the virtual column em_etgo_delivery_status on c_invoice
// and is called from NEO Headless every time a sales/purchase invoice grid
// is fetched. If anyone changes the function body, these tests catch any
// drift between the deployed implementation and the reference SQL below.
//
// Skips gracefully if a local Etendo DB is not reachable (CI runners that
// don't bring up Postgres should not fail).

let pool;
let dbAvailable = false;

before(async () => {
  try {
    pool = createDbPool();
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (pool) await pool.end();
});

describe('etgo_get_delivery_status — function signature', () => {
  it('exists with one varchar argument and returns numeric', async (t) => {
    if (!dbAvailable) return t.skip('Etendo DB not reachable');
    const { rows } = await pool.query(`
      SELECT
        pg_get_function_arguments(p.oid) AS args,
        pg_get_function_result(p.oid)    AS return_type
      FROM pg_proc p
      WHERE p.proname = 'etgo_get_delivery_status'
    `);
    assert.equal(rows.length, 1, 'function must be deployed exactly once');
    assert.match(rows[0].args, /character varying/);
    assert.match(rows[0].return_type, /numeric/);
  });

  it('returns 0 for an invoice that does not exist', async (t) => {
    if (!dbAvailable) return t.skip('Etendo DB not reachable');
    const { rows } = await pool.query(
      `SELECT etgo_get_delivery_status('00000000000000000000000000000000') AS pct`,
    );
    assert.equal(Number(rows[0].pct), 0);
  });
});

describe('etgo_get_delivery_status — calculation', () => {
  // Reference SQL: same logic as the function, computed inline. If this
  // matches the function output for every invoice, the function is correct.
  const REFERENCE_QUERY = `
    WITH per_line AS (
      SELECT
        il.c_invoice_id,
        ABS(il.qtyinvoiced) AS line_total,
        LEAST(
          ABS(il.qtyinvoiced),
          COALESCE((SELECT SUM(ABS(qty)) FROM m_matchinv
                     WHERE c_invoiceline_id = il.c_invoiceline_id), 0)
        + COALESCE((SELECT SUM(ABS(qty)) FROM m_matchsi
                     WHERE c_invoiceline_id = il.c_invoiceline_id), 0)
        ) AS line_delivered
      FROM c_invoiceline il
    )
    SELECT
      c_invoice_id,
      CASE WHEN SUM(line_total) = 0 THEN 0
           ELSE ROUND(100 * SUM(line_delivered) / SUM(line_total))
      END AS expected_pct
    FROM per_line
    GROUP BY c_invoice_id
  `;

  it('matches the reference calculation for every invoice with at least one matched line', async (t) => {
    if (!dbAvailable) return t.skip('Etendo DB not reachable');
    const { rows } = await pool.query(`
      SELECT
        ref.c_invoice_id,
        ref.expected_pct,
        etgo_get_delivery_status(ref.c_invoice_id) AS actual_pct
      FROM (${REFERENCE_QUERY}) ref
      WHERE EXISTS (
        SELECT 1
        FROM c_invoiceline il
        WHERE il.c_invoice_id = ref.c_invoice_id
          AND (
            EXISTS (SELECT 1 FROM m_matchinv WHERE c_invoiceline_id = il.c_invoiceline_id)
            OR EXISTS (SELECT 1 FROM m_matchsi WHERE c_invoiceline_id = il.c_invoiceline_id)
          )
      )
      LIMIT 200
    `);
    if (rows.length === 0) {
      t.skip('no invoices with matchinv/matchsi entries — nothing to validate');
      return;
    }
    for (const r of rows) {
      assert.equal(
        Number(r.actual_pct),
        Number(r.expected_pct),
        `etgo_get_delivery_status(${r.c_invoice_id}) returned ${r.actual_pct}, expected ${r.expected_pct}`,
      );
    }
  });

  it('returns 0 for invoices whose lines have no matching entries', async (t) => {
    if (!dbAvailable) return t.skip('Etendo DB not reachable');
    const { rows } = await pool.query(`
      SELECT etgo_get_delivery_status(c_invoice.c_invoice_id) AS pct
      FROM c_invoice
      WHERE NOT EXISTS (
        SELECT 1
        FROM c_invoiceline il
        WHERE il.c_invoice_id = c_invoice.c_invoice_id
          AND (
            EXISTS (SELECT 1 FROM m_matchinv WHERE c_invoiceline_id = il.c_invoiceline_id)
            OR EXISTS (SELECT 1 FROM m_matchsi WHERE c_invoiceline_id = il.c_invoiceline_id)
          )
      )
      LIMIT 25
    `);
    if (rows.length === 0) {
      t.skip('every invoice has at least one match — nothing to assert');
      return;
    }
    for (const r of rows) {
      assert.equal(Number(r.pct), 0, 'invoices with no matched lines must report 0%');
    }
  });

  it('caps the per-line delivered qty at qtyinvoiced (prevents > 100%)', async (t) => {
    if (!dbAvailable) return t.skip('Etendo DB not reachable');
    const { rows } = await pool.query(`
      SELECT MAX(etgo_get_delivery_status(c_invoice_id)) AS max_pct
      FROM c_invoice
    `);
    const maxPct = Number(rows[0].max_pct ?? 0);
    assert.ok(maxPct <= 100, `function returned ${maxPct}%, expected <= 100`);
    assert.ok(maxPct >= 0,   `function returned ${maxPct}%, expected >= 0`);
  });
});
