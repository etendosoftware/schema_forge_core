/**
 * report-db.js — the report server's shared DB pool, statement timeout, cancel
 * on client disconnect and per-tenant concurrency cap (ETP-6146).
 *
 * One pool per process (never one per request): the DB sees at most `max`
 * connections from the report server however many requests are in flight,
 * plus the short-lived connections that send a cancel (see `cancelBackend`).
 */

const intEnv = (name, dflt) => {
  const n = Number.parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

/**
 * Pool sizing and limits, read from env on every call.
 * @returns {{max: number, connectionTimeoutMillis: number, idleTimeoutMillis: number, statement_timeout: number, application_name: string}}
 */
export function getPoolLimits() {
  return {
    max: intEnv('REPORT_DB_POOL_MAX', 10),
    connectionTimeoutMillis: intEnv('REPORT_DB_CONNECT_TIMEOUT_MS', 10000),
    idleTimeoutMillis: intEnv('REPORT_DB_IDLE_TIMEOUT_MS', 30000),
    statement_timeout: intEnv('REPORT_STATEMENT_TIMEOUT_MS', 30000),
    application_name: 'etendo-report-server',
  };
}

/**
 * The statement timeout `/render` runs under: exports of large reports take
 * longer than an interactive `/query`, so it has its own, larger value.
 * @returns {number} milliseconds
 */
export function getRenderStatementTimeoutMs() {
  return intEnv('REPORT_RENDER_STATEMENT_TIMEOUT_MS', 120000);
}

let sharedPool;
let cancelConfig;

/**
 * The process-wide pool, created on first use. An idle client that fails (DB
 * restart, failover, a backend killed by an admin) makes pg emit `'error'` on
 * the pool; without a listener that would crash the server, so it is logged.
 *
 * @param {Function} PoolClass pg's `Pool`
 * @param {object} baseConfig connection settings (host, user, ssl...)
 * @param {Function} [ClientClass] pg's `Client`, used to send cancels outside the pool
 * @returns {object} the pool
 */
export function getSharedPool(PoolClass, baseConfig, ClientClass) {
  if (!sharedPool) {
    sharedPool = new PoolClass({ ...baseConfig, ...getPoolLimits() });
    sharedPool.on?.('error', (e) => console.error('[report-db] idle client error:', e?.message));
    cancelConfig = ClientClass ? { ClientClass, config: { ...baseConfig, application_name: 'etendo-report-cancel', connectionTimeoutMillis: getPoolLimits().connectionTimeoutMillis } } : undefined;
  }
  return sharedPool;
}

/** Tests only: forget the shared pool. */
export function resetSharedPool() {
  sharedPool = undefined;
  cancelConfig = undefined;
}

/**
 * Ends the shared pool (shutdown). Safe when no pool was ever created.
 * @returns {Promise<void>}
 */
export async function closeSharedPool() {
  const p = sharedPool;
  resetSharedPool();
  await p?.end();
}

/** The statement ran past the statement timeout. */
export class ReportTimeoutError extends Error {
  constructor() {
    super('Report query exceeded the statement timeout');
    this.name = 'ReportTimeoutError';
  }
}

/** The client went away (or the request was aborted) before the answer. */
export class ReportCancelledError extends Error {
  constructor() {
    super('Report query cancelled: the client went away');
    this.name = 'ReportCancelledError';
  }
}

/**
 * Postgres 57014 query_canceled: the statement timeout or a cancel request.
 * The SQLSTATE is language-independent; the message is not.
 * @param {Error} e
 * @returns {boolean}
 */
export function isQueryCanceled(e) {
  return e?.code === '57014';
}

/**
 * Whether `e` is a statement timeout. Only our own abort sends a cancel, and
 * callers check the abort first, so any other 57014 is the timeout (matching
 * the English message would miss databases running with another `lc_messages`).
 * @param {Error} e
 * @returns {boolean}
 */
export function isStatementTimeout(e) {
  return isQueryCanceled(e);
}

/**
 * Cancels a backend query from a short-lived dedicated connection, so the
 * cancel does not wait behind the saturated pool it is meant to relieve.
 * Falls back to the pool only when the pool was built without a Client class.
 * @param {object} pool
 * @param {number} pid the backend's processID
 * @returns {Promise<void>}
 */
async function cancelBackend(pool, pid) {
  if (!cancelConfig) {
    await pool.query('SELECT pg_cancel_backend($1)', [pid]);
    return;
  }
  const c = new cancelConfig.ClientClass(cancelConfig.config);
  await c.connect();
  try {
    await c.query('SELECT pg_cancel_backend($1)', [pid]);
  } finally {
    await c.end();
  }
}

/**
 * Runs `fn(db)` on a connection checked out of `pool`. `db.query` throws
 * ReportCancelledError once `signal` aborted, so a request abandoned between
 * two statements does not start the next one. When the signal aborts while a
 * statement runs, the backend query is cancelled and the connection destroyed
 * instead of reused.
 *
 * @param {object} pool pg Pool
 * @param {AbortSignal|undefined} signal aborts when the client disconnects
 * @param {(db: {query: Function}) => Promise<*>} fn
 * @param {{statementTimeoutMs?: number}} [opts] overrides the pool's statement timeout for this connection
 * @returns {Promise<*>} what `fn` returns
 * @throws {ReportCancelledError} aborted before or during the work
 * @throws {ReportTimeoutError} the statement timeout fired
 */
export async function withReportClient(pool, signal, fn, { statementTimeoutMs } = {}) {
  if (signal?.aborted) throw new ReportCancelledError();
  const client = await pool.connect();
  let discard = false;
  let onAbort;
  try {
    if (signal?.aborted) throw new ReportCancelledError();
    onAbort = () => {
      const pid = client.processID;
      if (pid == null) return;
      cancelBackend(pool, pid).catch((e) => console.error('[report-db] cancel failed:', e?.message));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (statementTimeoutMs) {
      await client.query(`SET statement_timeout = ${Math.trunc(Number(statementTimeoutMs))}`);
    }
    const db = {
      query: (...args) => {
        if (signal?.aborted) throw new ReportCancelledError();
        return client.query(...args);
      },
    };
    return await fn(db);
  } catch (e) {
    if (e instanceof ReportCancelledError) throw e;
    if (isQueryCanceled(e)) {
      discard = true;
      throw signal?.aborted ? new ReportCancelledError() : new ReportTimeoutError();
    }
    throw e;
  } finally {
    if (onAbort) signal?.removeEventListener('abort', onAbort);
    // A cancelled connection, or one whose timeout was overridden and cannot be reset, is not trusted back.
    if (signal?.aborted) discard = true;
    if (!discard && statementTimeoutMs) {
      try { await client.query('RESET statement_timeout'); } catch { discard = true; }
    }
    client.release(discard ? true : undefined);
  }
}

/**
 * Aborts a signal when the client goes away before the answer is written.
 * `close` also fires after a normal response, so it only aborts when the
 * response was not finished; `dispose` removes the listener once answered.
 *
 * @param {import('node:events').EventEmitter & {writableFinished?: boolean}} res
 * @returns {{signal: AbortSignal, dispose: () => void}}
 */
export function abortOnClose(res) {
  const ac = new AbortController();
  const onClose = () => { if (!res.writableFinished) ac.abort(); };
  res.on('close', onClose);
  return { signal: ac.signal, dispose: () => res.off('close', onClose) };
}

const tenantState = new Map(); // clientId -> { active, waiters: [] }

/**
 * Per-tenant concurrency cap: at most `limit` in-flight report queries per
 * ad_client_id; the rest wait their turn (a released slot is handed straight
 * to the next waiter). A waiting request leaves the queue when `signal` aborts.
 *
 * @param {string} clientId the tenant (ad_client_id)
 * @param {AbortSignal} [signal]
 * @param {number} [limit] defaults to REPORT_TENANT_CONCURRENCY (2)
 * @returns {Promise<() => void>} the release function; call it exactly once
 * @throws {ReportCancelledError} aborted before or while waiting
 */
export async function acquireTenantSlot(clientId, signal, limit = intEnv('REPORT_TENANT_CONCURRENCY', 2)) {
  if (signal?.aborted) throw new ReportCancelledError();
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
      const i = st.waiters.indexOf(waiter);
      if (i !== -1) st.waiters.splice(i, 1);
      reject(new ReportCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    st.waiters.push(waiter);
  });
  return release; // the slot was handed over by the releaser
}

/** Tests only: slots in use across every tenant (0 when nothing leaked). */
export function activeTenantSlots() {
  let n = 0;
  for (const st of tenantState.values()) n += st.active;
  return n;
}

/** Tests only: forget every tenant's slots. */
export function resetTenantSlots() {
  tenantState.clear();
}
