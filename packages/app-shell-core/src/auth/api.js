import { getStoredLocale } from '../i18n/useLocaleState.js';
import { canonicalEntityName, getRecordVersion, rememberRecordVersion } from '../lib/recordVersions.js';

export function detectBaseUrl() {
  // Guarded so this module can be imported outside a browser. `plain node --test` runs
  // (the root `npm test` glob) import modules that transitively reach this file, and an
  // unguarded window access made the whole module unloadable there (ETP-5022).
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return import.meta.env?.VITE_API_BASE || '';
}

/**
 * Resolved on first use rather than at import time, for the same reason: evaluating it
 * while the module loads would run browser-only code in every consumer, test runner
 * included. Cached afterwards, so the browser behaviour is unchanged - one resolution
 * per session.
 */
let cachedBaseUrl;
function defaultBaseUrl() {
  if (cachedBaseUrl === undefined) cachedBaseUrl = detectBaseUrl();
  return cachedBaseUrl;
}

/**
 * Headers for a READ request (GET): auth + the UI locale, and deliberately no
 * `Content-Type` (a GET has no body, so declaring one is wrong).
 *
 * `Accept-Language` is what makes the backend resolve reference data (`*_Trl`
 * names: countries, UoMs, AD_Ref_List, ...) into the locale the user picked in
 * the UI. When it is missing, `NeoAuthenticator.applyRequestLanguage` is a
 * SILENT no-op and the backend falls back to the user's AD language — so
 * selectors come back in English with no error anywhere (ETP-4685, ETP-5022).
 *
 * Always use this (or {@link buildHeaders} for writes) instead of hand-rolling
 * `{ Authorization: `Bearer ${token}` }` — that omission is exactly the defect
 * this helper exists to prevent, and a repo guardrail test enforces it.
 *
 * @param {string} [token] bearer token; omitted when absent
 * @returns {Record<string,string>} headers for a read request
 */
export function authHeaders(token) {
  const headers = {
    'Accept-Language': getStoredLocale(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Headers for a WRITE request (POST/PUT/DELETE with a JSON body): everything
 * {@link authHeaders} sends, plus `Content-Type: application/json`.
 */
export function buildHeaders(token) {
  return {
    ...authHeaders(token),
    'Content-Type': 'application/json',
  };
}

export function isTokenExpired(token) {
  return !token;
}

/**
 * Resolves a request URL against the client's base URL.
 *
 * Call sites reach this helper in two shapes, and both have to keep working during the
 * raw-`fetch` migration (ETP-5022): a bare path (`/spec/entity?x=1`), which is what a
 * freshly written call site passes, and a URL that ALREADY carries the base
 * (`${apiBaseUrl}/entity`), which is how ~147 pre-existing call sites build their URL.
 * Blindly concatenating would turn the second shape into `/etendo/etendo/entity`, so:
 *
 * - a fully-qualified URL (`https://...`) is used verbatim;
 * - a path that already starts with `base` is used verbatim;
 * - anything else is prefixed with `base`.
 *
 * An empty `base` makes every branch a no-op, which is the correct behaviour when the app
 * is served from the domain root.
 */
export function resolveApiUrl(base, path) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
  if (base && path.startsWith(base)) return path;
  return `${base}${path}`;
}

/**
 * The verbs that update an EXISTING record, and therefore both REQUIRE and INJECT the
 * optimistic-locking token on the way out (ETP-5073 / DOC-04). POST is absent on purpose here: a
 * create has no prior version to conflict with, so `withRecordVersion` must never attach one to a
 * POST body — see {@link withRecordVersion}.
 *
 * This set is scoped to injection only. Whether a verb's RESPONSE is harvested afterwards is a
 * separate question — see the harvest dispatch in `createApiFetch`, which also harvests POST
 * (ETP-5122): a create's response hands back the record's initial `updated`, and without
 * remembering it, saving that same record again later in the session (with no intervening read)
 * fails with 400 `missing_updated`.
 */
const VERSIONED_WRITE_METHODS = new Set(['PUT', 'PATCH']);

/**
 * Best-effort record id from a request path: the last non-empty segment, query string removed.
 *
 * Covers the NEO record shape (`/spec/entity/<id>`) for a body that does not repeat its own id.
 * A path whose tail is not an id (a collection, an `/action/<name>` sub-route) simply produces a
 * key nothing was ever remembered under, so the lookup misses and no token is injected — the
 * guard against injecting into a non-record write is the cache miss itself, not this parse.
 */
function recordIdFromPath(path) {
  if (typeof path !== 'string') return null;
  const withoutQuery = path.split('?')[0].split('#')[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  return segments.length ? segments[segments.length - 1] : null;
}

/**
 * Best-effort ENTITY (collection) from a request path, used together with the record id to key the
 * version cache — see the module docstring of `lib/recordVersions.js` for why the id alone is not
 * a unique key.
 *
 * The two shapes a NEO path takes resolve to the same string:
 *
 * - `/spec/entity/<id>` (a record) — the tail is the id, so the entity is the segment before it;
 * - `/spec/entity?parentId=...` (a collection) — the tail IS the entity.
 *
 * Which is why the id has to be passed in: it is the only way to tell `/price/<id>` from
 * `/order/price`. A tail that is not the id is taken as the entity, so an `/action/<name>`
 * sub-route yields `action`'s name — harmless, because nothing is ever remembered under it and
 * the lookup simply misses.
 *
 * The `decodeURIComponent` is NOT cosmetic: `ListModalWindow.jsx` writes to
 * `/${entity}/${encodeURIComponent(row.id)}`, so without decoding, the tail would not compare
 * equal to the raw id and we would return the ENCODED ID as the entity — silently keying the
 * write under a bucket the read never wrote. It is wrapped because `decodeURIComponent` throws on
 * a stray `%`, and a malformed path must degrade to a cache miss, not to an exception on every
 * request in the app.
 *
 * @param {string} path request path
 * @param {unknown} recordId the record id, when one is known
 * @returns {string|null} the entity segment, or null when the path has none
 */
export function entityFromPath(path, recordId) {
  if (typeof path !== 'string') return null;
  const withoutQuery = path.split('?')[0].split('#')[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  if (!segments.length) return null;
  const last = segments[segments.length - 1];
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    // Malformed escape sequence: compare the raw segment instead of failing the request.
  }
  if (recordId != null && decoded === String(recordId)) {
    return segments.length > 1 ? segments[segments.length - 2] : null;
  }
  return last;
}

/**
 * Adds the remembered `updated` to an update's body so the server's concurrency check can run.
 *
 * Every guard here fails OPEN (returns the request untouched) rather than guessing, because this
 * runs on every request in the app and most of them are not record updates:
 *
 * - not PUT/PATCH — nothing to guard;
 * - a non-string body (`FormData`, a blob) — an upload, not a JSON record write;
 * - a body that is not a JSON object — not a record;
 * - the caller already set `updated` — an explicit value always wins over a remembered one;
 * - no remembered version for this id — either the record was never read through this client, or
 *   the endpoint is not a NEO record at all (an OAuth2 PUT). This is the guard that keeps the
 *   injection from corrupting an unrelated write: an id we never saw has no entry, so nothing is
 *   added.
 *
 * When the token is genuinely missing the request goes out without it and the server answers 400
 * `missing_updated`. That is deliberate: it is a loud, actionable failure naming the remedy, and
 * the alternative — writing without a concurrency check — is the defect this ticket exists to fix.
 */
function withRecordVersion(path, rest) {
  const method = String(rest.method || 'GET').toUpperCase();
  if (!VERSIONED_WRITE_METHODS.has(method)) return rest;
  if (typeof rest.body !== 'string') return rest;
  let parsed;
  try {
    parsed = JSON.parse(rest.body);
  } catch {
    return rest;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return rest;
  if (parsed.updated) return rest;
  const id = parsed.id ?? recordIdFromPath(path);
  const version = getRecordVersion(id, entityFromPath(path, id));
  if (version === undefined) {
    warnUnversionedUpdate(method, path);
    return rest;
  }
  return { ...rest, body: JSON.stringify({ ...parsed, updated: version }) };
}

/**
 * Development-only notice that an update is going out with no concurrency token.
 *
 * Two very different situations reach here and only one is a defect, which is why this warns
 * instead of throwing: the endpoint may legitimately not be a NEO record (an OAuth2 PUT), or it
 * may be a record the panel never read — the case ETP-5073 has to
 * find. The server answers 400 `missing_updated` for the second, so the failure is already
 * loud in QA; this makes it identifiable at the exact call site while a developer is looking,
 * rather than only as a network error after the fact.
 *
 * Gated on `DEV` being explicitly true rather than on `PROD` being false: outside Vite (a plain
 * `node --test` run) `import.meta.env` is undefined, and a `!PROD` check would treat that as
 * "development" and print this on every suite that exercises an update.
 *
 * `MODE` is checked too because Vitest sets `DEV: true, MODE: 'test'` — so the DEV gate alone
 * still fired throughout the vitest suite, printing this into CI logs and adding a `console.warn`
 * call that any test spying on `console.warn` has to tolerate.
 *
 * Silent in production: it says nothing a user can act on, and the legitimate non-record writes
 * would make it noise.
 */
function warnUnversionedUpdate(method, path) {
  const env = import.meta.env;
  if (env?.DEV !== true || env?.MODE === 'test') return;
  // eslint-disable-next-line no-console
  console.warn(
    `[ETP-5073] ${method} ${path} is going out without an \`updated\` token. If this is a NEO `
    + 'record, the server will refuse it with 400 missing_updated: the panel needs to read the '
    + 'record (so its version is remembered) before writing it. If it is not a NEO record, '
    + 'ignore this.',
  );
}

/**
 * Returns an INDEPENDENT JSON-readable clone of a response, or null when harvesting must be
 * skipped. Shared by both harvesters so the two defensive guards live in exactly one place.
 *
 * `clone` is guarded, not assumed: a real `Response` always has it, but a test that stubs `fetch`
 * with a plain `{ ok, json }` object legitimately does not, and harvesting is an optimisation — it
 * must never be the reason a caller's request throws.
 *
 * And the clone must be a genuinely independent body. A real `Response.clone()` always is, but a
 * hand-rolled double may return `this` — and then reading it here consumes the single-use `json()`
 * the caller was going to read, starving the very request we are decorating. Harvesting is worth
 * nothing next to that, so an inseparable clone is simply skipped.
 */
function jsonClone(res) {
  if (!res?.ok || typeof res.clone !== 'function') return null;
  const copy = res.clone();
  if (!copy || copy === res || typeof copy.json !== 'function') return null;
  return copy;
}

/**
 * Every record in a response payload, whatever envelope it arrived in: the NEO
 * `{response: {data: [...]}}` shape, a bare array, or a single object.
 */
function recordsFromPayload(data) {
  const payload = data?.response?.data ?? data;
  return Array.isArray(payload) ? payload : [payload];
}

/**
 * Remembers the version of the record a successful write returned, so a second edit of the same
 * record in one sitting does not replay the token the first edit consumed (which the server would
 * correctly reject as a conflict, against a change the user themself just made).
 *
 * Reads a CLONE of the response — see {@link jsonClone}. Entirely best-effort: a 204, a non-JSON
 * body or an unexpected envelope leaves the cache as it was, and the next write falls back to the
 * loud 400/409 path.
 *
 * The entity is derived PER RECORD (ETP-5112), because a write's response may echo a record whose
 * id is not the one in the path.
 *
 * @returns {Promise<boolean>} whether the response actually carried a usable (id, `updated`)
 *   pair. Only the ACTION path reads it, to decide whether it still has to re-read the
 *   record; every other caller ignores it.
 */
function harvestWrittenVersion(res, path, isCurrent = () => true) {
  const copy = jsonClone(res);
  if (!copy) return Promise.resolve(false);
  // The promise is RETURNED, not floated (ETP-5255). `createApiFetch` awaits it before releasing
  // the next write to this record: a queued write reads its token from the cache, so if the
  // harvest were still in flight the queued write would go out with the token this response just
  // superseded — a 409 `stale_record` produced by the very serialisation meant to prevent it.
  return copy.json().then((data) => {
    // ETP-5195: the session can be replaced while this body is being parsed. A version harvested
    // under a session that is gone must not be remembered — it would arm the NEXT session's
    // write with a token that belongs to nobody.
    if (!isCurrent()) return false;
    const record = data?.response?.data?.[0] ?? data;
    rememberRecordVersion(record, entityFromPath(path, record?.id));
    // Reported so an ACTION can fall back to a re-read when its response carried no token. The
    // normal write path ignores this.
    return record?.id != null
      && typeof record?.updated === 'string'
      && record.updated !== '';
  }).catch(() => false);
}

/**
 * Remembers the version of every record a successful READ returned (ETP-5112).
 *
 * This is the half that was missing after ETP-5073: only `useEntity` and `useLineSaveConflict`
 * remembered anything, so the ~15 panels that read with `apiFetch` directly patched without a
 * token and got 400 `missing_updated`. Harvesting here makes any read through `apiFetch` — by id
 * or as a list — arm the write that follows it, with no opt-in at the call site.
 *
 * ALL rows are harvested, not just the first: list reads are the main case (inline edit in a grid:
 * Contacts, ProductPriceBar, actividadesDelIae), and the row the user edits is rarely row 0.
 *
 * Restricted to JSON responses by `content-type`, so a download, a blob or an HTML error page is
 * not cloned and parsed for nothing on every request in the app.
 *
 * The entity is derived PER RECORD: a GET by id (`/price/<id>`) and a GET of a collection
 * (`/price?parentId=...`) present different tail segments, and {@link entityFromPath} needs the
 * record's own id to tell them apart.
 *
 * Deliberately NOT paired with an auto-retry on 400 `missing_updated`: re-reading the record and
 * replaying the write would pick up whatever `updated` the row has NOW, silently overwriting a
 * change someone else made in between. That is precisely the last-writer-wins behaviour ETP-5073
 * removed, so a missing token must stay a visible failure.
 */
function harvestReadVersions(res, path, isCurrent = () => true) {
  const contentType = res?.headers?.get?.('content-type') || '';
  if (!contentType.toLowerCase().includes('json')) return Promise.resolve();
  const copy = jsonClone(res);
  if (!copy) return Promise.resolve();
  // Returned rather than floated, so the action re-read can wait for it (ETP-5255). The GET path
  // in `createApiFetch` deliberately does NOT await it: that would add the cost of parsing a
  // clone of the body to every read in the app, and a read arms a LATER write, which a render
  // almost always separates from it.
  return copy.json().then((data) => {
    // ETP-5195 — see `harvestWrittenVersion` for why a superseded session harvests nothing.
    if (!isCurrent()) return;
    recordsFromPayload(data).forEach((record) => {
      rememberRecordVersion(record, entityFromPath(path, record?.id));
    });
  }).catch(() => {
    // No body, not JSON, or a shape we do not recognise. Nothing to remember.
  });
}

/**
 * The canonical way to make an authenticated request.
 *
 * On top of `fetch` it guarantees the four things every hand-rolled call site had to
 * remember on its own: the canonical headers (so `Accept-Language` is never missing —
 * see {@link authHeaders}), the base URL, `credentials: 'include'`, dropping
 * `Content-Type` for `FormData`, and routing a 401 to the logout handler instead of
 * letting each call site invent its own expired-session behaviour.
 *
 * Recognised extra options (everything else is forwarded to `fetch` untouched):
 *
 * - `on401: 'ignore'` — do NOT log out or throw; hand the 401 response back to the
 *   caller. For endpoints whose 401 is a domain answer rather than an expired session
 *   (e.g. `lib/upgrade/api.js` maps it to its own `sessionExpired` error code), and for
 *   probes that treat "unauthorized" as "feature unavailable".
 * - `credentials` — overrides the default `'include'`.
 * - `token` — use this bearer token instead of the session's. For a plain module that is
 *   handed a token by its caller (importers, descriptors, report builders): the request
 *   stays explicit about whose token it uses, and the module keeps working with no session
 *   registered at all.
 * - `baseUrl: ''` — for a URL that is already complete, or that points outside the base
 *   (a helper such as `buildCreateUrl` returns a sibling path from the app root, which
 *   the base-prefix guard cannot recognise as already-resolved).
 *
 * @param {string|null|undefined} baseUrl prefix for relative paths; `null`/`undefined`
 *   falls back to the base detected from the page location
 * @param {() => (string|null)} getToken reads the current bearer token
 * @param {() => void} onUnauthorized invoked once when a 401 is not ignored
 */
/**
 * record key → the last versioned write dispatched to that record.
 *
 * ## Why this has to exist here and nowhere else
 *
 * `updated` is a PER-RECORD token, so the record is the only correct unit of write serialisation.
 * Two writers of one row that never see each other both read the token the last response left in
 * the cache, both send it, and the server correctly refuses the second as a 409 `stale_record` —
 * against a change the user themself just made, reported to them as "somebody else edited this
 * record". Neither writer is wrong on its own; the conflict only exists between them.
 *
 * And they only meet HERE. A guard inside a component can only see that component's own writes,
 * which is why the same defect was found and fixed four separate times at four different layers
 * (per input, per field, per panel) before landing on the record. The concrete pair that motivated
 * this: on `/user/{id}` the header's "Activo" `Switch` PATCHes through `runInlineToggleRequest`
 * while the detail form PUTs through `useEntity` — two modules with no shared state, one row.
 *
 * ## What this does and does not promise
 *
 * It serialises: at most one versioned write per record is in flight, and the next one reads its
 * token AFTER the previous response has been harvested. It does NOT coalesce, roll back, debounce
 * or dedupe — a panel that wants a mid-flight edit folded into one request keeps using
 * `useRecordWriteQueue`, which layers those on top. Writes to DIFFERENT records stay fully
 * parallel; nothing here introduces a global lock.
 *
 * Entries are deleted as each write settles, so this never grows beyond the number of records
 * being written to concurrently.
 *
 * @type {Map<string, Promise<Response>>}
 */
/**
 * For a POST to `/{spec}/{entity}/{id}/action/<name>`, the path of the RECORD that action acts on.
 * `null` for anything else.
 *
 * ## Why the version cache cannot be kept correct without this
 *
 * A process action mutates the row server-side — `docAction: 'CO'` moves a document out of draft
 * and recalculates its totals — so the row's `updated` advances. Nothing tells the client: the
 * action's response carries the PROCESS result, not the record (verified in
 * `NeoButtonActionHelper.executeButtonActionCore`, which returns
 * `NeoProcessService.executeProcess(...)` directly). So the cached token is superseded the moment
 * any action succeeds, and the next write of that record is refused 409 `stale_record` — reported
 * to the user as "somebody else edited this record", when the editor was the process they just
 * launched themselves. Worse, it is unrecoverable by retrying, which is exactly what a user does.
 *
 * Harvesting the action's own response cannot fix this, because there is nothing in it to harvest.
 * The proper fix is for the action response to echo the record's fresh `updated` (one place,
 * serving every client including MCP); until that ships, re-reading the record here is what keeps
 * this module's own cache honest. When the backend does echo it, the re-read below can be deleted
 * and only this path parsing stays.
 *
 * The path is otherwise parsed as if the action suffix were not there, so `entityFromPath` yields
 * the real entity (`header`) instead of the action's name (`documentAction`) — the bucket the
 * record's versions actually live in.
 */
function actionRecordPath(path) {
  if (typeof path !== 'string') return null;
  const withoutQuery = path.split('#')[0].split('?')[0];
  const segments = withoutQuery.split('/');
  // Shortest shape that can carry one: /<spec>/<entity>/<id>/action/<name>.
  if (segments.length < 5) return null;
  if (segments[segments.length - 2] !== 'action') return null;
  // The action's own name must be present, and the id must not be empty.
  if (!segments[segments.length - 1] || !segments[segments.length - 3]) return null;
  return segments.slice(0, -2).join('/');
}

const recordWriteChains = new Map();

/**
 * Identity prefix for a write queue: who is writing, not which token they hold. A silent token
 * rotation must leave a queued write in its own queue, so the bearer is deliberately absent —
 * see `sessionController.isSameIdentity` for the same distinction.
 *
 * Falls back to a shared bucket when there is no scope (a legacy three-argument client, a test),
 * which is exactly the pre-ETP-5195 behaviour.
 */
function sessionQueueKey(requestScope) {
  const snapshot = requestScope?.capture?.();
  if (!snapshot) return '';
  return [snapshot.userId, snapshot.clientId, snapshot.sessionClientId, snapshot.apiBaseUrl]
    .map((part) => (part == null ? '' : String(part))).join('\u0001');
}

/**
 * The serialisation key for a versioned write, or `null` when the request is not a record write
 * this can identify.
 *
 * Keyed on (entity, id) — the same pair `lib/recordVersions.js` buckets versions under, aliases
 * included, which is why the entity goes through {@link canonicalEntityName}. Keying it any other
 * way would let two names for one table race exactly as two components did.
 *
 * Returns `null` — meaning "dispatch immediately, unserialised" — whenever the record cannot be
 * identified, matching the fail-open policy of every other guard in this module: a write we cannot
 * key is a write we must not delay.
 *
 * Prefixed with the SESSION (ETP-5255 x ETP-5195). `recordWriteChains` is module state that
 * outlives a login, and (entity, id) carries no tenant: without this, two clients holding the same
 * record id share one queue, and a write left unsettled by a session that is gone gates the first
 * write the next session makes to that key. Scoping the key keeps both isolated, and needs no
 * teardown — entries still delete themselves as each write settles.
 */
function recordWriteKey(path, rest, sessionKey) {
  if (typeof rest.body !== 'string') return null;
  let parsed;
  try {
    parsed = JSON.parse(rest.body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const id = parsed.id ?? recordIdFromPath(path);
  if (id == null || id === '') return null;
  const entity = canonicalEntityName(entityFromPath(path, id));
  // \u0000 cannot occur in a path segment, so no (session, entity, id) triple can collide.
  return `${sessionKey}\u0000${entity ?? ''}\u0000${String(id)}`;
}

/**
 * Test seam: drops every pending write chain, so a suite that leaves a write unresolved cannot
 * make the next suite's write wait on it forever.
 */
export function resetRecordWriteChainsForTests() {
  recordWriteChains.clear();
}

export function createApiFetch(baseUrl, getToken, onUnauthorized, scope) {
  return async function apiFetch(path, options = {}) {
    const {
      on401, credentials, baseUrl: baseUrlOverride, token: tokenOverride,
      headers: extraHeaders, ...rest
    } = options;
    // Legacy three-argument clients inherit the registered scope, including host wrappers
    // with a captured token. Explicit null opts out (bootstrap refresh owns its guard).
    const owner = scope === null ? null : ambientSession;
    const requestScope = scope === undefined ? owner?.scope : scope;
    const configured = baseUrlOverride !== undefined ? baseUrlOverride : baseUrl;
    const base = configured != null ? configured : defaultBaseUrl();

    /**
     * The session as it stands RIGHT NOW, captured once per dispatch.
     *
     * Everything here was hoisted to call time by ETP-5195, which was correct while a request
     * left immediately. ETP-5255 put a queue in between, so a write can now sit for an
     * arbitrary time between being asked for and going out — and a bearer, a snapshot or a set
     * of headers frozen before that wait describes a session that may no longer exist.
     *
     * A registered owner's null token means logged out, not "no owner": never fall back to a
     * legacy client's captured bearer after that boundary.
     */
    const resolveSession = () => {
      // `getToken` is the CLIENT's own reader. For a scoped client it reads through to the live
      // session, so re-reading it here is what re-arms a queued write with the rotated bearer.
      // For a legacy client it is a closure over a token captured at construction — which is
      // precisely what the comparison below is for.
      const token = tokenOverride !== undefined ? tokenOverride : getToken();
      // A registered owner's null token means logged out, not "no owner". Never fall back to a
      // legacy client's captured bearer after that boundary.
      const live = owner ? owner.getToken() : getToken();
      if (requestScope && tokenOverride === undefined && token !== live) throw staleSessionError();
      const snapshot = requestScope?.capture();
      const isCurrent = () => (scope === null || ambientSession === owner)
        && (requestScope ? requestScope.isCurrent(snapshot) : scope === null || getToken() === live);
      return { token, snapshot, isCurrent };
    };

    /**
     * The identity of the session that ASKED for this request, captured now and re-checked when
     * the request actually goes out.
     *
     * Capturing it is the whole point: `resolveSession` reads the session as it stands at
     * dispatch time, so on its own it cannot tell "the queue held me for 200ms and the token
     * rotated" (fine, re-arm) from "the queue held me for 200ms and the user logged out"
     * (not fine). After a logout both `getToken()` readings agree — they are both null — and a
     * snapshot captured after the fact is trivially current, so the queued write would sail
     * through and reach the server with NO `Authorization` header at all.
     *
     * Identity only, token deliberately excluded: a rotation between the ask and the dispatch is
     * routine and must be absorbed; a logout, another user, another client or another base URL
     * must not. See `sessionController.isSameIdentity`.
     */
    const enqueuedIdentity = tokenOverride === undefined ? requestScope?.capture() : undefined;
    const stillOurs = () => {
      if (!requestScope || enqueuedIdentity === undefined) return true;
      return typeof requestScope.isSameIdentity === 'function'
        ? requestScope.isSameIdentity(enqueuedIdentity)
        : requestScope.isCurrent(enqueuedIdentity);
    };
    // Fail fast, so a request whose session is already gone never enters the queue and never
    // delays a live one behind it.
    if (!stillOurs()) throw staleSessionError();

    /**
     * The single exit for every response, so the ETP-5195 guards cannot be applied on one
     * branch and forgotten on the other — `dispatch` returns from two places (an action, and
     * everything else) and ETP-5255 had copied the 401 block into both.
     *
     * The 401 only logs out when the bearer that earned it is still the live one. A 401 for a
     * token that has since been rotated away says nothing about the session that replaced it.
     */
    const finish = (res, token, isCurrent) => {
      if (res.status === 401 && on401 !== 'ignore') {
        const live = owner ? owner.getToken() : getToken();
        if (token === live) onUnauthorized?.();
        throw new Error('Unauthorized');
      }
      return requestScope ? guardResponse(res, isCurrent) : res;
    };

    const verb = String(rest.method || 'GET').toUpperCase();

    // `awaitHarvest` is true only on the serialised path: the next write to this record reads its
    // token from the cache, so it must not start until this response has been written INTO the
    // cache. Unserialised requests keep the previous fire-and-forget behaviour, so their latency
    // is unchanged.
    /**
     * Brings the version cache back in step with a record an action just mutated.
     *
     * ## Why a re-read, and not the action's own response
     *
     * Having the backend echo the record's new `updated` was considered and rejected: a process
     * does not only advance the token, it rewrites the row — `docAction: 'CO'` moves the document
     * out of draft and recalculates its totals. A token alone would leave the client armed to
     * write while still DISPLAYING the pre-action values, so the record has to be read again in
     * any case. Echoing the token would buy nothing and cost a backend contract.
     *
     * Note what this does and does not repair: it refreshes THIS CACHE, not the caller's state.
     * Whatever the user is looking at is still the pre-action record until the component refetches
     * it. That refetch is the component's job (`onRefresh`) and cannot be done from here.
     *
     * An action's response cannot be harvested generically either, whatever it carries:
     * `createGoodsReceipt` returns the goods receipt it CREATED, `createPurchaseInvoice` the
     * invoice — different records. Reading one of those as if it were the acted-on record files a
     * sibling document's token under this record and, worse, looks like it worked.
     *
     * Gated on ALREADY holding a version for the record: this keeps THIS cache honest, and a
     * record the client never read has nothing to keep honest — without the gate every action in
     * the app would pay for a GET no write was ever going to use.
     *
     * Failure is silent by design. A refused or unparseable re-read leaves the cache exactly as
     * the action found it, so the next write falls back to the loud 400/409 path rather than this
     * best-effort refresh turning a request that already succeeded into an error.
     */
    const refreshVersionAfterAction = async (recordPath, token, isCurrent) => {
      const id = recordIdFromPath(recordPath);
      if (id == null || id === '') return;
      if (getRecordVersion(id, entityFromPath(recordPath, id)) === undefined) return;
      try {
        const reread = await fetch(resolveApiUrl(base, recordPath), {
          credentials: credentials || 'include',
          headers: authHeaders(token),
        });
        if (reread.ok) await harvestReadVersions(reread, recordPath, isCurrent);
      } catch {
        // Offline, aborted, CORS — the action itself succeeded and must not be reported as failed.
      }
    };

    const dispatch = async (awaitHarvest) => {
      // ETP-5255 x ETP-5195: the session is resolved HERE, not at call time. A serialised write
      // waits an arbitrary time behind the write ahead of it, and the bearer can rotate while it
      // waits; sending the frozen one would earn a 401 and log the user out over a save they
      // legitimately made. Exactly the reason `withRecordVersion` is also read inside this
      // function and not before the queue wait.
      // The session that asked for this write may have ended while it waited its turn.
      if (!stillOurs()) throw staleSessionError();
      const { token, isCurrent } = resolveSession();
      // A bodyless request (GET, DELETE) gets authHeaders, which deliberately omits
      // Content-Type — declaring a body type on a request that has no body is wrong, and
      // it also keeps a migrated call site byte-identical on the wire to the raw `fetch`
      // it replaced.
      const canonical = rest.body === undefined ? authHeaders(token) : buildHeaders(token);
      const headers = { ...canonical, ...extraHeaders };
      if (rest.body instanceof FormData) delete headers['Content-Type'];
      // ETP-5073 / DOC-04: the optimistic-locking token is attached here, not at the ~41 call
      // sites that issue an update. See `withRecordVersion` for why every guard fails open.
      // Read INSIDE the dispatch, never before the queue wait — a write that resolved its token
      // while waiting its turn would carry the value the write ahead of it already consumed.
      const withVersion = withRecordVersion(path, rest);
      const res = await fetch(resolveApiUrl(base, path), {
        ...withVersion,
        credentials: credentials || 'include',
        headers,
      });
      // ETP-5195: the session went away while this was in flight. The response is not ours.
      if (!isCurrent()) throw staleSessionError();
      // ETP-5255: a process action mutates the row, so the token this client holds for it is
      // superseded the moment the action succeeds. Two ways to learn the new one, in this order:
      // harvest it from the action's response if the backend echoes the record (the proper fix,
      // `NeoButtonActionHelper.executeButtonActionCore`), and only otherwise re-read the record.
      // Keeping both means the client is correct against a backend that does NOT echo it yet —
      // which is every deployed one, since the SPA and the backend ship independently — and the
      // extra round trip disappears on its own once the backend does, with no client change.
      const actionPath = verb === 'POST' ? actionRecordPath(path) : null;
      if (actionPath !== null) {
        if (res.ok) await refreshVersionAfterAction(actionPath, token, isCurrent);
        return finish(res, token, isCurrent);
      }
      if (VERSIONED_WRITE_METHODS.has(verb) || verb === 'POST') {
        // ETP-5122: a POST (create) is harvested exactly like PUT/PATCH — its response echoes the
        // new record with its initial `updated` — but it is NOT added to
        // VERSIONED_WRITE_METHODS, because that set also gates injection in `withRecordVersion`,
        // and a create must never send an `updated` token on its own request. This branch only
        // arms the version cache for whatever PATCH/PUT saves this same record next, without a
        // re-read in between (e.g. "Add SII" then "Save" on the record it just created).
        const harvested = harvestWrittenVersion(res, path, isCurrent);
        if (awaitHarvest) await harvested;
      } else if (verb === 'GET') {
        // ETP-5112: a read is what arms the write that follows it. See `harvestReadVersions`.
        harvestReadVersions(res, path, isCurrent);
      }
      return finish(res, token, isCurrent);
    };

    // ETP-5255: at most one versioned write per record in flight. See `recordWriteChains`.
    const writeKey = VERSIONED_WRITE_METHODS.has(verb)
      ? recordWriteKey(path, rest, sessionQueueKey(requestScope))
      : null;
    if (writeKey === null) return dispatch(false);

    const previous = recordWriteChains.get(writeKey);
    const mine = (async () => {
      // A failed predecessor must not strand its successors: this waits for the slot, and takes
      // no position on whether the write ahead succeeded. Deciding to abandon a queued write
      // after a failure is policy, and belongs to the caller (`useRecordWriteQueue` does exactly
      // that); serialisation here stays mechanism only.
      if (previous) await previous.catch(() => {});
      return dispatch(true);
    })();
    recordWriteChains.set(writeKey, mine);
    // Only the tail clears the entry, so a slower predecessor settling late cannot delete a
    // successor's slot and let a third write race it.
    mine.catch(() => {}).then(() => {
      if (recordWriteChains.get(writeKey) === mine) recordWriteChains.delete(writeKey);
    });
    return mine;
  };
}

function staleSessionError() {
  return new DOMException('The request belongs to a superseded session.', 'AbortError');
}

// Guard body consumption too: fetch can finish before a logout while json() is pending.
function guardResponse(response, isCurrent) {
  return new Proxy(response, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === 'clone') return () => guardResponse(target.clone(), isCurrent);
      if (['json', 'text', 'blob', 'arrayBuffer', 'formData', 'bytes'].includes(key) && typeof value === 'function') {
        return async (...args) => {
          if (!isCurrent()) throw staleSessionError();
          const result = await value.apply(target, args);
          if (!isCurrent()) throw staleSessionError();
          return result;
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Ambient session accessor, so a NON-React module can make an authenticated request
 * without every one of its callers threading `token` and `apiBaseUrl` through the
 * signature (ETP-5022). `useApiFetch` stays the right tool inside a component or hook;
 * this exists for the plain-module layer underneath it (importers, descriptors,
 * webhook clients) where there is no React context to read.
 *
 * Registered once by the app shell. Until then {@link apiFetch} falls back to an
 * anonymous request rather than throwing, so a module that loads before the provider
 * mounts (or in a test that never mounts one) behaves like the raw `fetch` it replaced.
 */
let ambientSession = null;

export function registerApiSession({ getToken, onUnauthorized, baseUrl, scope, replaceSession } = {}) {
  const registration = {
    getToken: typeof getToken === 'function' ? getToken : () => null,
    onUnauthorized: typeof onUnauthorized === 'function' ? onUnauthorized : () => {},
    baseUrl,
    scope,
    replaceSession,
  };
  ambientSession = registration;
  return function unregister() {
    if (ambientSession === registration) ambientSession = null;
  };
}

/**
 * Reads the ambient bearer token, or null when no session is registered. Lets
 * {@link useApiFetch} keep working in a tree with no `AuthProvider` above it instead of
 * throwing — see its own doc comment for why that matters.
 */
export function getAmbientToken() {
  return ambientSession ? ambientSession.getToken() : null;
}

/** Fires the ambient logout handler, if one is registered. */
export function notifyAmbientUnauthorized() {
  ambientSession?.onUnauthorized();
}

/** Synchronous handoff for core onboarding writers before cache cleanup/navigation. */
export function replaceAmbientSession(session) {
  ambientSession?.replaceSession?.(session);
}

/** Test seam: drops the ambient session so suites do not leak one into the next. */
export function resetApiSessionForTests() {
  ambientSession = null;
}

/**
 * Authenticated `fetch` bound to the ambient session — same contract and same extra
 * options as the function {@link createApiFetch} returns.
 */
export function apiFetch(path, options = {}) {
  const session = ambientSession;
  return createApiFetch(
    session ? session.baseUrl : undefined,
    session ? session.getToken : () => null,
    session ? session.onUnauthorized : () => {},
    session?.scope,
  )(path, options);
}
