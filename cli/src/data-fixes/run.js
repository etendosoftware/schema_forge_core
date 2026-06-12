/**
 * run.js — Tenant data-fix runner.
 *
 * Flyway-style corrective remediation for existing Etendo GO tenants. Applies
 * timestamped `.sql` data-fixes from `cli/src/data-fixes/sql/`, recording state
 * in the System-owned ledger `ETGO_DATA_FIX_HISTORY`.
 *
 * Usage:
 *   node cli/src/data-fixes/run.js [--client <id>] [--dry-run]
 *       Phase 0 (baseline sweep) + Phase 1 (apply the chain, fail-fast per tenant).
 *
 *   node cli/src/data-fixes/run.js --fix <id> [--client <id>]
 *       Apply EXACTLY one fix, ignoring chain order and the baseline cutoff,
 *       and do not advance to any other fix.
 *
 *   node cli/src/data-fixes/run.js --mark-fixed --client <id> --fix <id> --reason "..."
 *       Mark a fix as MANUALLY_FIXED (operator resolved it out-of-band). Counts
 *       as success; runs neither @check nor @apply. --reason is mandatory.
 *
 * Ledger row shape (System-owned): every row has ad_client_id='0', ad_org_id='0',
 * and the remediated tenant in remediated_client_id. One row per
 * (remediated_client_id, fix_id). Status set:
 *   APPLIED, SKIPPED_NOT_NEEDED, FAILED, BASELINE, DETECTED, MANUALLY_FIXED.
 *
 * Checksum is deferred — the column stays NULL until CHECKSUM_MISMATCH lands.
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDbPool, closePool } from '../db.js';
import { parseFix, parseFixTimestamp, inlineParams } from './parse-fix.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SQL_DIR = join(__dirname, 'sql');

// Ledger table name. Inlined as a literal in every query below (never
// interpolated) so SonarQube S2077 — "Formatting SQL queries" — never fires:
// the table is a fixed system identifier and all variable data goes via binds.
const SYSTEM_CLIENT = '0';
const SYSTEM_ORG = '0';
const BASELINE_FIX_ID = '__baseline__';
const DETECTED_UTC = '2026-01-01'; // legacy tenants: nothing known applied

const STATUS = {
  APPLIED: 'APPLIED',
  SKIPPED: 'SKIPPED_NOT_NEEDED',
  FAILED: 'FAILED',
  BASELINE: 'BASELINE',
  DETECTED: 'DETECTED',
  MANUALLY_FIXED: 'MANUALLY_FIXED',
};

// Statuses that count as "already processed" for this tenant. They advance the
// strict date watermark — the runner starts applying AFTER the newest fix in
// this set and never looks back before it (out-of-order merges below the
// watermark are intentionally not picked up). FAILED is excluded so it retries.
const PROCESSED = new Set([STATUS.APPLIED, STATUS.MANUALLY_FIXED, STATUS.SKIPPED]);

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  // Maps a value-taking flag to the args key it populates with the next token.
  const VALUE_FLAGS = { '--client': 'client', '--fix': 'fix', '--reason': 'reason' };
  const args = { dryRun: false, markFixed: false, client: null, fix: null, reason: null };
  const tokens = [...argv];
  while (tokens.length) {
    const a = tokens.shift();
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--mark-fixed') args.markFixed = true;
    else if (a in VALUE_FLAGS) args[VALUE_FLAGS[a]] = tokens.shift();
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/** Load and parse every `.sql` fix, sorted chronologically by file name. */
async function loadCatalog() {
  let files;
  try {
    files = await readdir(SQL_DIR);
  } catch {
    return [];
  }
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b));
  const catalog = [];
  for (const file of sqlFiles) {
    const fixId = file.slice(0, -'.sql'.length);
    const text = await readFile(join(SQL_DIR, file), 'utf-8');
    const fix = parseFix(text, fixId);
    fix.timestamp = parseFixTimestamp(fixId);
    catalog.push(fix);
  }
  return catalog;
}

// ---------------------------------------------------------------------------
// Ledger access
// ---------------------------------------------------------------------------

/** Tenants (excluding System) that have NO ledger row at all. */
async function tenantsWithoutLedger(pool, onlyClient) {
  // $1 NULL => no client filter (sweep all tenants); otherwise scope to that client.
  const { rows } = await pool.query(
    `SELECT c.ad_client_id FROM ad_client c
       WHERE c.ad_client_id <> '0'
         AND ($1::varchar IS NULL OR c.ad_client_id = $1)
         AND NOT EXISTS (SELECT 1 FROM etgo_data_fix_history h
                          WHERE h.remediated_client_id = c.ad_client_id)
       ORDER BY c.ad_client_id`,
    [onlyClient || null],
  );
  return rows.map(r => r.ad_client_id);
}

/** Resolve the tenant universe to process (those that have ledger rows). */
async function resolveTenants(pool, onlyClient) {
  // $1 NULL => all tenants; otherwise scope to that client. No string formatting.
  const { rows } = await pool.query(
    `SELECT ad_client_id FROM ad_client
       WHERE ad_client_id <> '0'
         AND ($1::varchar IS NULL OR ad_client_id = $1)
       ORDER BY ad_client_id`,
    [onlyClient || null],
  );
  return rows.map(r => r.ad_client_id);
}

/** All ledger rows for a tenant as a Map(fix_id → {status, applied_utc}). */
async function fetchLedgerMap(pool, clientId) {
  const { rows } = await pool.query(
    `SELECT fix_id, status, applied_utc FROM etgo_data_fix_history WHERE remediated_client_id = $1`,
    [clientId],
  );
  const map = new Map();
  for (const r of rows) map.set(r.fix_id, { status: r.status, appliedUtc: r.applied_utc });
  return map;
}

/**
 * Upsert a ledger row. Uses the UNIQUE(remediated_client_id, fix_id) constraint
 * for ON CONFLICT. Runs on the given querier (pool for standalone writes, or a
 * transaction client when atomic with @apply).
 *
 * No-downgrade guard: an existing success state (APPLIED / MANUALLY_FIXED) is
 * never overwritten by a SKIPPED_NOT_NEEDED or FAILED write — a re-check (e.g.
 * a forced `--fix`) must not erase the record that the fix already succeeded.
 * APPLIED and MANUALLY_FIXED as the NEW status always win (upgrade / explicit).
 *
 * @returns {Promise<boolean>} true if a row was inserted or updated, false if
 *   the write was suppressed by the no-downgrade guard.
 */
async function writeLedger(querier, { clientId, fixId, status, appliedUtc, rowsAffected = 0, detail = null }) {
  const res = await querier.query(
    `INSERT INTO etgo_data_fix_history
       (etgo_data_fix_history_id, ad_client_id, ad_org_id, isactive,
        created, createdby, updated, updatedby,
        remediated_client_id, fix_id, status, applied_utc, rows_affected, detail)
     VALUES (get_uuid(), $1, $2, 'Y', now(), '0', now(), '0', $3, $4, $5, $6, $7, $8)
     ON CONFLICT (remediated_client_id, fix_id) DO UPDATE
       SET status = EXCLUDED.status,
           applied_utc = EXCLUDED.applied_utc,
           rows_affected = EXCLUDED.rows_affected,
           detail = EXCLUDED.detail,
           updated = now(), updatedby = '0'
       WHERE NOT (etgo_data_fix_history.status IN ('APPLIED', 'MANUALLY_FIXED')
                  AND EXCLUDED.status IN ('SKIPPED_NOT_NEEDED', 'FAILED'))`,
    [SYSTEM_CLIENT, SYSTEM_ORG, clientId, fixId, status, appliedUtc, rowsAffected, detail],
  );
  return res.rowCount > 0;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/** Run a (possibly multi-statement) body and return the summed rowCount. */
async function runBody(querier, body) {
  const result = await querier.query(body);
  const results = Array.isArray(result) ? result : [result];
  return results.reduce((sum, r) => sum + (r.rowCount || 0), 0);
}

/**
 * Apply one fix to one tenant.
 * @returns {Promise<{status: string, rows: number, detail: string|null}>}
 */
async function applyFix(pool, fix, clientId, { dryRun }) {
  const binds = { client_id: clientId, org_id: SYSTEM_ORG };

  if (fix.type === 'webhook') {
    // The webhook owns its own atomicity; the runner cannot wrap it in a SQL tx.
    // (Webhook invocation is not implemented yet — surface that clearly.)
    throw new Error(`${fix.fixId}: @type webhook not implemented yet (webhook="${fix.webhook}")`);
  }

  const checkSql = inlineParams(fix.check, binds);
  const checkRows = await runBody(pool, checkSql);
  if (checkRows === 0) {
    if (!dryRun) {
      const wrote = await writeLedger(pool, {
        clientId, fixId: fix.fixId, status: STATUS.SKIPPED, appliedUtc: new Date(),
      });
      if (!wrote) {
        return { status: STATUS.SKIPPED, rows: 0, detail: 'kept prior success state' };
      }
    }
    return { status: STATUS.SKIPPED, rows: 0, detail: null };
  }

  if (dryRun) {
    return { status: 'WOULD_APPLY', rows: 0, detail: `@check matched (${checkRows} row(s))` };
  }

  // @apply + ledger write share ONE transaction (atomic).
  const applySql = inlineParams(fix.apply, binds);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await runBody(client, applySql);
    await writeLedger(client, {
      clientId, fixId: fix.fixId, status: STATUS.APPLIED, appliedUtc: new Date(), rowsAffected: rows,
    });
    await client.query('COMMIT');
    return { status: STATUS.APPLIED, rows, detail: null };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Record FAILED in a SEPARATE transaction (the rollback undid everything else).
    const detail = String(err.message || err).slice(0, 2000);
    await writeLedger(pool, {
      clientId, fixId: fix.fixId, status: STATUS.FAILED, appliedUtc: new Date(), detail,
    }).catch(() => {});
    return { status: STATUS.FAILED, rows: 0, detail };
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/** Phase 0 — sweep: DETECTED baseline for tenants with no ledger row. */
async function sweepBaseline(pool, onlyClient, { dryRun }) {
  const tenants = await tenantsWithoutLedger(pool, onlyClient);
  for (const clientId of tenants) {
    console.log(`  [sweep] ${clientId} → DETECTED (applied_utc=${DETECTED_UTC})`);
    if (!dryRun) {
      await writeLedger(pool, {
        clientId, fixId: BASELINE_FIX_ID, status: STATUS.DETECTED, appliedUtc: DETECTED_UTC,
      });
    }
  }
  return tenants.length;
}

/**
 * Compute the strict date watermark for a tenant: the newest timestamp among
 * the baseline row and every PROCESSED fix. The runner applies only fixes with
 * timestamp strictly greater than this — it never looks back before it.
 */
function computeWatermark(catalog, ledger) {
  const baseline = ledger.get(BASELINE_FIX_ID);
  let watermark = baseline ? new Date(baseline.appliedUtc).getTime() : -Infinity;
  for (const fix of catalog) {
    const row = ledger.get(fix.fixId);
    if (row && PROCESSED.has(row.status) && fix.timestamp) {
      watermark = Math.max(watermark, fix.timestamp.getTime());
    }
  }
  return watermark;
}

/** Phase 1 — apply the chain for one tenant, fail-fast. Returns true if halted. */
async function applyChain(pool, catalog, clientId, { dryRun }) {
  const ledger = await fetchLedgerMap(pool, clientId);
  const watermark = computeWatermark(catalog, ledger);
  const wmLabel = watermark === -Infinity ? 'none' : new Date(watermark).toISOString();
  console.log(`\nTenant ${clientId} (watermark: ${wmLabel})`);

  for (const fix of catalog) {
    // Strict watermark: skip everything at or before it (no look-back).
    if (fix.timestamp && fix.timestamp.getTime() <= watermark) continue;

    const res = await applyFix(pool, fix, clientId, { dryRun });
    const detailMessage = res.detail ? ` — ${res.detail}` : '';
    const rowCountMessage = res.rows ? ` (${res.rows} rows)` : '';
    console.log(`  ${fix.fixId}: ${res.status}${rowCountMessage}${detailMessage}`);

    if (res.status === STATUS.FAILED) {
      console.log(`  ↳ chain halted for ${clientId}; later fixes left un-run.`);
      return true; // halted
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdMarkFixed(pool, { client, fix, reason }) {
  if (!client) throw new Error('--mark-fixed requires --client <id>');
  if (!fix) throw new Error('--mark-fixed requires --fix <id>');
  if (!reason) throw new Error('--mark-fixed requires --reason "<what was done by hand>"');
  await writeLedger(pool, {
    clientId: client, fixId: fix, status: STATUS.MANUALLY_FIXED, appliedUtc: new Date(),
    rowsAffected: 0, detail: reason,
  });
  console.log(`Marked ${fix} as MANUALLY_FIXED for ${client}: ${reason}`);
}

async function cmdTargetedFix(pool, catalog, { client, fix, dryRun }) {
  const target = catalog.find(f => f.fixId === fix || f.id === fix);
  if (!target) throw new Error(`--fix: no such fix "${fix}" in catalog`);
  const tenants = client ? [client] : await resolveTenants(pool, null);
  console.log(`Targeted run of ${target.fixId} (ignores order + cutoff) for ${tenants.length} tenant(s)`);
  let failed = 0;
  for (const clientId of tenants) {
    const res = await applyFix(pool, target, clientId, { dryRun });
    const rowCountMessage = res.rows ? ` (${res.rows} rows)` : '';
    const detailedMessage = res.detail ? ` — ${res.detail}` : '';
    console.log(`  ${clientId}: ${res.status}${rowCountMessage}${detailedMessage}`);
    if (res.status === STATUS.FAILED) failed++;
  }
  return failed;
}

async function cmdFullRun(pool, catalog, { client, dryRun }) {
  console.log('=== Phase 0 — baseline sweep ===');
  const swept = await sweepBaseline(pool, client, { dryRun });
  console.log(`  ${swept} tenant(s) baselined as DETECTED.`);

  console.log('\n=== Phase 1 — apply ===');
  const tenants = await resolveTenants(pool, client);
  let halted = 0;
  for (const clientId of tenants) {
    if (await applyChain(pool, catalog, clientId, { dryRun })) halted++;
  }
  console.log(`\nDone. ${tenants.length} tenant(s) processed, ${halted} halted.`);
  return halted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Map a count of failed/halted tenants to a process exit code. */
function toExitCode(count) {
  return count > 0 ? 1 : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = createDbPool();
  let exitCode = 0;

  try {
    if (args.markFixed) {
      await cmdMarkFixed(pool, args);
    } else {
      const catalog = await loadCatalog();
      if (args.dryRun) console.log('(dry-run: no writes will be committed)\n');

      if (args.fix) {
        const failed = await cmdTargetedFix(pool, catalog, { client: args.client, fix: args.fix, dryRun: args.dryRun });
        exitCode = toExitCode(failed);
      } else {
        if (catalog.length === 0) console.log('No .sql fixes in catalog (cli/src/data-fixes/sql/).');
        const halted = await cmdFullRun(pool, catalog, { client: args.client, dryRun: args.dryRun });
        exitCode = toExitCode(halted);
      }
    }
  } finally {
    await closePool(pool);
  }

  process.exit(exitCode);
}

main().catch(err => {
  console.error('data-fixes runner failed:', err.message || err);
  process.exit(2);
});
