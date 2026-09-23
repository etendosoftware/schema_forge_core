/**
 * Tests for report-auth.js — session-cookie identity resolution for the
 * report engines (ETP-5460).
 *
 * Before this module, both report engines (`tools/report-server/server.js`
 * and, in the functional repo, `report-api.js`) read `Authorization: Bearer`
 * only, and decoded the JWT payload locally WITHOUT verifying its signature
 * to pull `clientId` — a forged token could read another tenant's SQL
 * reports. The SPA moved to an HttpOnly `__Host-go_session` cookie
 * (ETP-4576/4575) and stopped sending `Authorization` entirely, so every
 * report call degraded silently: NEO calls threw "No auth token", SQL/
 * selector reports fell back to `clientId || '0'` (System scope, empty
 * report, no error).
 *
 * This module replaces both: it resolves identity by calling
 * `GET /sws/go/session`, forwarding ONLY the session cookie pair (never the
 * whole incoming Cookie header, never relaying Set-Cookie back), and never
 * falls back to '0'. See design id 455 / spec id 454 (report-session-auth).
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import http from 'node:http';

import {
  ReportAuthError,
  extractSessionCookie,
  resolveReportSession,
  reportAuthErrorBody,
} from '../src/report-auth.js';

const SESSION_COOKIE = '__Host-go_session=abc123';
const ETENDO_BASE = 'http://etendo.test/etendo';

function sessionResponse({
  ok = true,
  status = 200,
  environment = { clientId: 'C1', orgId: 'O1', roleId: 'R1', userId: 'U1' },
  csrfToken = 'csrf-good',
  json = true,
} = {}) {
  return {
    ok,
    status,
    json: async () => {
      if (!json) throw new Error('not JSON');
      return { status: 'ok', environment, csrfToken };
    },
  };
}

function fetchSpy(responseOrFn) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    return typeof responseOrFn === 'function' ? responseOrFn(url, init) : responseOrFn;
  };
  impl.calls = calls;
  return impl;
}

describe('extractSessionCookie', () => {
  it('extracts the session cookie pair from a Cookie header with several cookies', () => {
    const header = `other=1; ${SESSION_COOKIE}; another=2`;
    assert.equal(extractSessionCookie(header), SESSION_COOKIE);
  });

  it('returns null when there is no session cookie', () => {
    assert.equal(extractSessionCookie('other=1; another=2'), null);
  });

  it('returns null for an empty or missing header', () => {
    assert.equal(extractSessionCookie(''), null);
    assert.equal(extractSessionCookie(undefined), null);
    assert.equal(extractSessionCookie(null), null);
  });

  it('extracts the cookie when it is the only one present', () => {
    assert.equal(extractSessionCookie(SESSION_COOKIE), SESSION_COOKIE);
  });
});

describe('resolveReportSession — no session cookie', () => {
  it('rejects with 401 and makes no fetch call when there is no cookie header', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    await assert.rejects(
      resolveReportSession({}, { etendoBase: ETENDO_BASE, fetchImpl }),
      (err) => {
        assert.ok(err instanceof ReportAuthError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'NO_SESSION');
        return true;
      },
    );
    assert.equal(fetchImpl.calls.length, 0, 'must not call /sws/go/session without a session cookie');
  });

  it('rejects with 401 when the Cookie header has other cookies but not the session one', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    await assert.rejects(
      resolveReportSession({ cookie: 'other=1' }, { etendoBase: ETENDO_BASE, fetchImpl }),
      { status: 401, code: 'NO_SESSION' },
    );
    assert.equal(fetchImpl.calls.length, 0);
  });
});

describe('resolveReportSession — invalid/expired session', () => {
  it('rejects with 401 when Etendo answers non-200', async () => {
    const fetchImpl = fetchSpy(sessionResponse({ ok: false, status: 401 }));
    await assert.rejects(
      resolveReportSession({ cookie: SESSION_COOKIE }, { etendoBase: ETENDO_BASE, fetchImpl }),
      { status: 401, code: 'NO_SESSION' },
    );
  });

  it('rejects with 401 when environment is null/absent', async () => {
    const fetchImpl = fetchSpy(sessionResponse({ environment: null }));
    await assert.rejects(
      resolveReportSession({ cookie: SESSION_COOKIE }, { etendoBase: ETENDO_BASE, fetchImpl }),
      { status: 401, code: 'NO_SESSION' },
    );
  });

  it('rejects with 401 when clientId is blank inside environment — never falls back to \'0\'', async () => {
    const fetchImpl = fetchSpy(sessionResponse({ environment: { orgId: 'O1' } }));
    await assert.rejects(
      resolveReportSession({ cookie: SESSION_COOKIE }, { etendoBase: ETENDO_BASE, fetchImpl }),
      { status: 401, code: 'NO_SESSION' },
    );
  });
});

describe('resolveReportSession — backend unreachable (never surfaced as 401)', () => {
  it('rejects with 502 on a network error', async () => {
    const fetchImpl = fetchSpy(() => { throw new Error('ECONNREFUSED'); });
    await assert.rejects(
      resolveReportSession({ cookie: SESSION_COOKIE }, { etendoBase: ETENDO_BASE, fetchImpl }),
      (err) => {
        assert.ok(err instanceof ReportAuthError);
        assert.equal(err.status, 502);
        assert.equal(err.code, 'SESSION_BACKEND_UNAVAILABLE');
        assert.notEqual(err.status, 401, 'a backend blip must never look like an expired session to the SPA');
        return true;
      },
    );
  });

  it('rejects with 502 (not 401) when Etendo answers 5xx', async () => {
    const fetchImpl = fetchSpy(sessionResponse({ ok: false, status: 503 }));
    await assert.rejects(
      resolveReportSession({ cookie: SESSION_COOKIE }, { etendoBase: ETENDO_BASE, fetchImpl }),
      { status: 502, code: 'SESSION_BACKEND_UNAVAILABLE' },
    );
  });

  it('rejects with 502 when the session response body is not JSON', async () => {
    const fetchImpl = fetchSpy(sessionResponse({ json: false }));
    await assert.rejects(
      resolveReportSession({ cookie: SESSION_COOKIE }, { etendoBase: ETENDO_BASE, fetchImpl }),
      { status: 502, code: 'SESSION_BACKEND_UNAVAILABLE' },
    );
  });
});

describe('resolveReportSession — valid session (GET / safe method)', () => {
  it('resolves clientId/orgId/roleId/userId from environment', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    const session = await resolveReportSession(
      { cookie: SESSION_COOKIE }, { method: 'GET', etendoBase: ETENDO_BASE, fetchImpl },
    );
    assert.equal(session.clientId, 'C1');
    assert.equal(session.orgId, 'O1');
    assert.equal(session.roleId, 'R1');
    assert.equal(session.userId, 'U1');
  });

  it('calls GET /sws/go/session forwarding ONLY the session cookie pair, never the whole incoming Cookie header', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    await resolveReportSession(
      { cookie: `unrelated=xyz; ${SESSION_COOKIE}; other=1` },
      { method: 'GET', etendoBase: ETENDO_BASE, fetchImpl },
    );
    assert.equal(fetchImpl.calls.length, 1);
    const { url, init } = fetchImpl.calls[0];
    assert.equal(url, `${ETENDO_BASE}/sws/go/session`);
    assert.equal(init.headers.Cookie, SESSION_COOKIE);
  });

  it('does not require or forward a CSRF header for a safe (GET) method', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    const session = await resolveReportSession(
      { cookie: SESSION_COOKIE }, { method: 'GET', etendoBase: ETENDO_BASE, fetchImpl },
    );
    assert.equal('X-Go-CSRF' in session.forwardHeaders, false);
  });

  it('forwards the incoming Origin header', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    const session = await resolveReportSession(
      { cookie: SESSION_COOKIE, origin: 'https://app.test' },
      { method: 'GET', etendoBase: ETENDO_BASE, fetchImpl },
    );
    assert.equal(session.forwardHeaders.Origin, 'https://app.test');
    assert.equal('Referer' in session.forwardHeaders, false);
  });

  it('falls back to Referer when Origin is absent', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    const session = await resolveReportSession(
      { cookie: SESSION_COOKIE, referer: 'https://app.test/reports/x' },
      { method: 'GET', etendoBase: ETENDO_BASE, fetchImpl },
    );
    assert.equal(session.forwardHeaders.Referer, 'https://app.test/reports/x');
    assert.equal('Origin' in session.forwardHeaders, false);
  });

  it('never relays a Set-Cookie header from the session response', async () => {
    const fetchImpl = fetchSpy({
      ...sessionResponse(),
      headers: { get: () => 'go_session=rotated; Path=/' },
    });
    const session = await resolveReportSession(
      { cookie: SESSION_COOKIE }, { method: 'GET', etendoBase: ETENDO_BASE, fetchImpl },
    );
    assert.ok(!JSON.stringify(session).includes('rotated'));
    assert.equal('Set-Cookie' in session.forwardHeaders, false);
  });

  it('defaults etendoBase to http://localhost:8080/etendo when not supplied', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    await resolveReportSession({ cookie: SESSION_COOKIE }, { method: 'GET', fetchImpl });
    assert.equal(fetchImpl.calls[0].url, 'http://localhost:8080/etendo/sws/go/session');
  });

  it('defaults method to GET (safe) when not supplied', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    const session = await resolveReportSession({ cookie: SESSION_COOKIE }, { etendoBase: ETENDO_BASE, fetchImpl });
    assert.equal('X-Go-CSRF' in session.forwardHeaders, false);
  });
});

describe('resolveReportSession — CSRF on unsafe methods (POST)', () => {
  it('rejects with 403 when X-Go-CSRF is missing', async () => {
    const fetchImpl = fetchSpy(sessionResponse());
    await assert.rejects(
      resolveReportSession(
        { cookie: SESSION_COOKIE }, { method: 'POST', etendoBase: ETENDO_BASE, fetchImpl },
      ),
      { status: 403, code: 'CSRF_REJECTED' },
    );
  });

  it('rejects with 403 when X-Go-CSRF does not match the session csrfToken', async () => {
    const fetchImpl = fetchSpy(sessionResponse({ csrfToken: 'csrf-good' }));
    await assert.rejects(
      resolveReportSession(
        { cookie: SESSION_COOKIE, 'x-go-csrf': 'csrf-wrong' },
        { method: 'POST', etendoBase: ETENDO_BASE, fetchImpl },
      ),
      { status: 403, code: 'CSRF_REJECTED' },
    );
  });

  it('rejects with 403 (not throws a raw error) when the CSRF header and token differ in length', async () => {
    // A naive `===` is already constant-count-safe against length mismatches,
    // but a naive timing-unsafe compare on equal-length strings is the actual
    // risk; this case only pins the length-mismatch path doesn't crash.
    const fetchImpl = fetchSpy(sessionResponse({ csrfToken: 'a-much-longer-token-value' }));
    await assert.rejects(
      resolveReportSession(
        { cookie: SESSION_COOKIE, 'x-go-csrf': 'short' },
        { method: 'POST', etendoBase: ETENDO_BASE, fetchImpl },
      ),
      { status: 403, code: 'CSRF_REJECTED' },
    );
  });

  it('succeeds and forwards the CSRF header when it matches the session csrfToken', async () => {
    const fetchImpl = fetchSpy(sessionResponse({ csrfToken: 'csrf-good' }));
    const session = await resolveReportSession(
      { cookie: SESSION_COOKIE, 'x-go-csrf': 'csrf-good' },
      { method: 'POST', etendoBase: ETENDO_BASE, fetchImpl },
    );
    assert.equal(session.forwardHeaders['X-Go-CSRF'], 'csrf-good');
    assert.equal(session.forwardHeaders.Cookie, SESSION_COOKIE);
  });

  it('is case-insensitive for the method (post/POST) and the header name', async () => {
    const fetchImpl = fetchSpy(sessionResponse({ csrfToken: 'csrf-good' }));
    const session = await resolveReportSession(
      { cookie: SESSION_COOKIE, 'X-Go-CSRF': 'csrf-good' },
      { method: 'post', etendoBase: ETENDO_BASE, fetchImpl },
    );
    assert.equal(session.forwardHeaders['X-Go-CSRF'], 'csrf-good');
  });
});

describe('reportAuthErrorBody', () => {
  it('maps a ReportAuthError to its status and a JSON body with the code', () => {
    const { status, body } = reportAuthErrorBody(new ReportAuthError(401, 'NO_SESSION', 'No session'));
    assert.equal(status, 401);
    assert.equal(body.code, 'NO_SESSION');
    assert.equal(body.error, 'No session');
  });

  it('maps an unexpected (non-ReportAuthError) error to 502 rather than leaking it as 401', () => {
    const { status, body } = reportAuthErrorBody(new Error('boom'));
    assert.equal(status, 502);
    assert.equal(body.code, 'SESSION_BACKEND_UNAVAILABLE');
  });
});

/**
 * Open question from the design (id 455): can Node's own `fetch` (undici)
 * send a custom `Origin` header at all, or does undici treat it as a
 * forbidden/managed header the way browsers do? This is NOT exercised via
 * the injectable fetchImpl above — it drives the REAL global fetch against a
 * local HTTP server to settle the question for good.
 */
describe('undici Origin header — open question from design id 455', () => {
  it('Node global fetch (undici) DOES send a caller-supplied Origin header verbatim', async () => {
    let receivedOrigin;
    const server = http.createServer((req, res) => {
      receivedOrigin = req.headers.origin;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
    await new Promise((res) => server.listen(0, '127.0.0.1', res));
    const { port } = server.address();
    try {
      await fetch(`http://127.0.0.1:${port}/`, { headers: { Origin: 'https://app.test' } });
    } finally {
      await new Promise((res) => server.close(res));
    }
    assert.equal(receivedOrigin, 'https://app.test',
      'undici must forward a caller-set Origin header unmodified — resolveReportSession relies on this');
  });
});
