/**
 * ETP-5460 — server.js authenticates report requests via the session cookie
 * (`report-auth.js`'s `resolveReportSession`) instead of an unverified
 * Bearer JWT. Before this, `getClientIdFromToken` decoded the JWT payload
 * WITHOUT verifying its signature, and every SQL/selector path silently fell
 * back to `clientId || '0'` (System scope) instead of erroring — see
 * discovery id 456 / scope-decision id 457.
 *
 * `server.js` starts an HTTP listener on import and its DB access goes
 * through a dynamically imported `pg` Pool, so — following the same
 * source-scan + replicated-function convention as
 * `server-neo-accept-language.test.js` and `server-branding-org-lookup.test.js`
 * — this suite verifies the wiring against the REAL server.js text and
 * exercises the REAL `resolveReportSession` (imported directly, never
 * replicated) with an injectable `fetchImpl`. It does not require a real
 * Postgres or NEO instance: a no-cookie request must be rejected by the
 * auth guard BEFORE any DB/NEO access is attempted at all, which the source
 * ordering assertions below pin down.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolveReportSession, ReportAuthError, reportAuthErrorBody } from '../../../cli/src/report-auth.js';

const SERVER_SRC = readFileSync(fileURLToPath(new URL('../server.js', import.meta.url)), 'utf8');

describe('server.js — imports report-auth.js instead of decoding the JWT locally', () => {
  it('imports resolveReportSession and reportAuthErrorBody from the shared module', () => {
    assert.match(SERVER_SRC, /import \{ resolveReportSession, reportAuthErrorBody \} from '\.\.\/\.\.\/cli\/src\/report-auth\.js'/);
  });

  it('no longer defines or calls getClientIdFromToken — the unverified JWT decode is gone', () => {
    assert.doesNotMatch(SERVER_SRC, /getClientIdFromToken/,
      'getClientIdFromToken (unverified JWT payload decode) must be fully removed, not just unused');
  });

  it('no longer reads req.headers.authorization for report identity', () => {
    assert.doesNotMatch(SERVER_SRC, /req\.headers\.authorization/,
      'identity must come from resolveReportSession(req.headers, ...), never a raw Authorization read');
  });
});

describe('server.js — renderReport (POST /api/reports/:id/render) resolves the session BEFORE fetching data', () => {
  it('calls resolveReportSession with req.headers and req.method before fetchReportData', () => {
    const renderStart = SERVER_SRC.indexOf('async function renderReport(');
    assert.ok(renderStart >= 0);
    const renderEnd = SERVER_SRC.indexOf('\nasync function handleRequest', renderStart);
    const renderFn = SERVER_SRC.slice(renderStart, renderEnd);

    const sessionCallIdx = renderFn.search(/await resolveReportSession\(req\.headers, \{ method: req\.method, etendoBase: ETENDO_URL \}\)/);
    const fetchDataIdx = renderFn.indexOf('await fetchReportData(reportId, { limit, session, params, locale })');
    assert.ok(sessionCallIdx >= 0, 'renderReport must call resolveReportSession');
    assert.ok(fetchDataIdx >= 0, 'renderReport must pass session (not authToken) into fetchReportData');
    assert.ok(sessionCallIdx < fetchDataIdx, 'the session must be resolved BEFORE any report data fetch (no DB/NEO access on an unauthenticated request)');
  });

  it('maps a ReportAuthError to its own status via reportAuthErrorBody, not a generic 500', () => {
    const renderStart = SERVER_SRC.indexOf('async function renderReport(');
    const renderEnd = SERVER_SRC.indexOf('\nasync function handleRequest', renderStart);
    const renderFn = SERVER_SRC.slice(renderStart, renderEnd);
    assert.match(renderFn, /const \{ status, body: errorBody \} = reportAuthErrorBody\(e\)/);
    assert.match(renderFn, /json\(res, status, errorBody\)/);
  });
});

describe('server.js — fetchReportDataById (GET /api/reports/:id/data) resolves the session BEFORE fetching data', () => {
  it('calls resolveReportSession before fetchReportData and forwards no authToken', () => {
    const fnStart = SERVER_SRC.indexOf('async function fetchReportDataById(');
    assert.ok(fnStart >= 0);
    const fnEnd = SERVER_SRC.indexOf('\nfunction isGetDataRequest', fnStart);
    const fn = SERVER_SRC.slice(fnStart, fnEnd);

    const sessionCallIdx = fn.search(/await resolveReportSession\(req\.headers, \{ method: req\.method, etendoBase: ETENDO_URL \}\)/);
    const fetchDataIdx = fn.indexOf('await fetchReportData(reportId, { limit, session })');
    assert.ok(sessionCallIdx >= 0);
    assert.ok(fetchDataIdx >= 0);
    assert.ok(sessionCallIdx < fetchDataIdx, 'no DB/NEO access must happen before the session is resolved');
    assert.doesNotMatch(fn, /authToken/, 'must not forward an authToken anywhere in this handler');
  });
});

describe('server.js — fetchReportSelectors (GET /api/report-selectors/:type) resolves the session BEFORE any query', () => {
  it('calls resolveReportSession before building any query, and scopes byClient unconditionally', () => {
    const fnStart = SERVER_SRC.indexOf('async function fetchReportSelectors(');
    assert.ok(fnStart >= 0);
    const fnEnd = SERVER_SRC.indexOf('\nfunction addWarehouseOrgFilters', fnStart);
    const fn = SERVER_SRC.slice(fnStart, fnEnd);

    const sessionCallIdx = fn.search(/await resolveReportSession\(req\.headers, \{ method: req\.method, etendoBase: ETENDO_URL \}\)/);
    const byClientIdx = fn.indexOf("const byClient = (col) => `AND ${col} = '${clientId}'`;");
    assert.ok(sessionCallIdx >= 0, 'fetchReportSelectors must resolve the session');
    assert.ok(byClientIdx >= 0, 'byClient must be unconditional now that clientId is always resolved by this point');
    assert.ok(sessionCallIdx < byClientIdx);
    assert.doesNotMatch(fn, /byClient = \(col\) => clientId \? /,
      'the old conditional byClient (silently unscoped when clientId was null) must be gone');
  });
});

/**
 * Behavioral coverage of the auth-gating contract itself, exercising the
 * REAL resolveReportSession (never replicated) the same way server.js calls
 * it: `resolveReportSession(req.headers, { method, etendoBase, fetchImpl })`.
 */
describe('resolveReportSession — as server.js calls it', () => {
  it('rejects a request with no session cookie with 401, and this happens before any pool/NEO access could occur', async () => {
    let sessionFetchCalled = false;
    const fetchImpl = async () => { sessionFetchCalled = true; return { ok: true, json: async () => ({}) }; };
    await assert.rejects(
      resolveReportSession({}, { method: 'GET', etendoBase: 'http://etendo.test/etendo', fetchImpl }),
      (err) => { assert.ok(err instanceof ReportAuthError); assert.equal(err.status, 401); return true; },
    );
    assert.equal(sessionFetchCalled, false, 'no cookie means no request to Etendo at all — and by extension no downstream DB/NEO call in server.js');
  });

  it('a valid session on a POST (render) request produces forwardHeaders carrying both Cookie and X-Go-CSRF', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ environment: { clientId: 'C1', orgId: 'O1' }, csrfToken: 'good-csrf' }),
    });
    const session = await resolveReportSession(
      { cookie: '__Host-go_session=abc', 'x-go-csrf': 'good-csrf' },
      { method: 'POST', etendoBase: 'http://etendo.test/etendo', fetchImpl },
    );
    assert.equal(session.forwardHeaders.Cookie, '__Host-go_session=abc');
    assert.equal(session.forwardHeaders['X-Go-CSRF'], 'good-csrf');
    assert.equal(session.clientId, 'C1');
  });

  it('a GET (data/selectors) request never requires or forwards a CSRF header', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ environment: { clientId: 'C1' }, csrfToken: 'irrelevant' }),
    });
    const session = await resolveReportSession(
      { cookie: '__Host-go_session=abc' },
      { method: 'GET', etendoBase: 'http://etendo.test/etendo', fetchImpl },
    );
    assert.equal('X-Go-CSRF' in session.forwardHeaders, false);
  });

  it('maps every ReportAuthError this module can throw into a status server.js can respond with directly', () => {
    for (const [status, code] of [[401, 'NO_SESSION'], [403, 'CSRF_REJECTED'], [502, 'SESSION_BACKEND_UNAVAILABLE']]) {
      const { status: mappedStatus, body } = reportAuthErrorBody(new ReportAuthError(status, code, 'x'));
      assert.equal(mappedStatus, status);
      assert.equal(body.code, code);
    }
  });
});
