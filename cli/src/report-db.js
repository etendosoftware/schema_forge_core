/**
 * report-db.js — the report server's shared DB pool, statement timeout, cancel
 * on client disconnect and per-tenant concurrency cap (ETP-6146).
 *
 * One pool per process (never one per request): the DB sees at most `max`
 * connections from the report server however many requests are in flight.
 */

const intEnv = (name, dflt) => {
  const n = Number.parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

/** Pool sizing and limits, overridable per container through env. */
export function getPoolLimits() {
  return {
    max: intEnv('REPORT_DB_POOL_MAX', 10),
    connectionTimeoutMillis: intEnv('REPORT_DB_CONNECT_TIMEOUT_MS', 10000),
    idleTimeoutMillis: intEnv('REPORT_DB_IDLE_TIMEOUT_MS', 30000),
    statement_timeout: intEnv('REPORT_STATEMENT_TIMEOUT_MS', 30000),
  };
}

let sharedPool;

/** The process-wide pool, created on first use. `PoolClass` is pg's Pool. */
export function getSharedPool(PoolClass, baseConfig) {
  if (!sharedPool) sharedPool = new PoolClass({ ...baseConfig, ...getPoolLimits() });
  return sharedPool;
}

/** Tests only: forget the shared pool. */
export function resetSharedPool() {
  sharedPool = undefined;
}

export class ReportTimeoutError extends Error {
  constructor() {
    super('Report query exceeded the statement timeout');
    this.name = 'ReportTimeoutError';
  }
}

export class ReportCancelledError extends Error {
  constructor() {
    super('Report query cancelled: the client went away');
    this.name = 'ReportCancelledError';
  }
}

/** Postgres 57014 query_canceled: the statement timeout, or a cancel request. */
export function isQueryCanceled(e) {
  return e?.code === '57014';
}

export function isStatementTimeout(e) {
  return isQueryCanceled(e) && /statement timeout/i.test(e.message || '');
}

/**
 * Runs `fn(client)` on a connection checked out of `pool`. When `signal`
 * aborts while `fn` runs, the backend query is cancelled with
 * pg_cancel_backend and the connection is destroyed rather than reused.
 * Rejects with ReportCancelledError after an abort, ReportTimeoutError when
 * the statement timeout fired.
 */
export async function withReportClient(pool, signal, fn) {
  if (signal?.aborted) throw new ReportCancelledError();
  const client = await pool.connect();
  let cancelled = false;
  const onAbort = () => {
    cancelled = true;
    const pid = client.processID;
    if (pid == null) return;
    pool.query('SELECT pg_cancel_backend($1)', [pid]).catch((e) => {
      console.error('[report-db] cancel failed:', e?.message);
    });
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  let discard = false;
  try {
    return await fn(client);
  } catch (e) {
    discard = isQueryCanceled(e);
    if (cancelled && isQueryCanceled(e)) throw new ReportCancelledError();
    if (isStatementTimeout(e)) throw new ReportTimeoutError();
    throw e;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    // A cancelled connection is not trusted back into the pool.
    client.release(cancelled || discard ? true : undefined);
  }
}

const tenantState = new Map(); // clientId -> { active, waiters: [] }

/**
 * Per-tenant concurrency cap: at most `limit` in-flight report queries per
 * ad_client_id; the rest wait their turn. A waiting request leaves the queue
 * when `signal` aborts. Returns a release function.
 */
export async function acquireTenantSlot(clientId, signal, limit = intEnv('REPORT_TENANT_CONCURRENCY', 2)) {
  const key = String(clientId ?? '');
  let st = tenantState.get(key);
  if (!st) tenantState.set(key, (st = { active: 0, waiters: [] }));
  const release = () => {
    const next = st.waiters.shift();
    if (next) next();
    else if (--st.active === 0) tenantState.delete(key);
  };
  if (st.active < limit) {
    st.active++;
    return release;
  }
  await new Promise((resolve, reject) => {
    const waiter = () => { signal?.removeEventListener('abort', onAbort); resolve(); };
    const onAbort = () => {
      st.waiters.splice(st.waiters.indexOf(waiter), 1);
      reject(new ReportCancelledError());
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    st.waiters.push(waiter);
  });
  return release; // the slot was handed over by the releaser
}
