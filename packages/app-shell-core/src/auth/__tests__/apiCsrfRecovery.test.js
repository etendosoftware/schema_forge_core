import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, registerApiSession, resetApiSessionForTests } from '../api.js';
import {
  CREDENTIAL_MODES, getSessionCsrfToken, resetSessionCredentials, setSessionCredentials,
} from '../sessionCredentials.js';
import { resetRecordVersionsForTests } from '../../lib/recordVersions.js';

// ETP-5550 — the CSRF proof lives in memory per tab while the session cookie is shared by the
// whole browser. When another tab rotates the session, this tab keeps sending the proof of the
// revoked one and every write answers 403 until F5. apiFetch recovers once: it asks the session
// owner for the live proof (a GET /sws/go/session, which never rotates) and resends the request.

const STALE = 'csrf-of-the-rotated-session';
const LIVE = 'csrf-of-the-live-session';
const STALE_CSRF_REFUSAL = { error: { message: 'CSRF validation failed', status: 403 } };
const ORIGIN_REFUSAL = { error: { message: 'Origin not allowed', status: 403 } };

const originalFetch = globalThis.fetch;

function response(body, status) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

/** Answers each request with the next queued response and records what was sent. */
function stubFetch(...responses) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', csrf: options.headers?.['X-Go-CSRF'] });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return typeof next === 'function' ? next() : next;
  };
  return calls;
}

/** Registers a cookie-session owner whose recovery hands back `recovered`. */
function registerOwner(recovered) {
  let recoveries = 0;
  registerApiSession({
    getToken: () => null,
    baseUrl: '',
    recoverCsrfToken: async () => {
      recoveries += 1;
      const token = typeof recovered === 'function' ? await recovered() : recovered;
      if (token) setSessionCredentials({ mode: CREDENTIAL_MODES.auto, token: null, csrfToken: token });
      return token;
    },
  });
  return { recoveries: () => recoveries };
}

beforeEach(() => {
  setSessionCredentials({ mode: CREDENTIAL_MODES.auto, token: null, csrfToken: STALE });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiSessionForTests();
  resetSessionCredentials();
  resetRecordVersionsForTests();
});

describe('apiFetch recovers from a stale CSRF proof once (ETP-5550)', () => {
  it('re-reads the live proof and resends the write with it', async () => {
    const owner = registerOwner(LIVE);
    const calls = stubFetch(response(STALE_CSRF_REFUSAL, 403), response({ ok: true }, 200));

    const res = await apiFetch('/sales/order/callout', { method: 'POST', body: '{}' });

    assert.equal(res.status, 200);
    assert.equal(owner.recoveries(), 1);
    assert.deepEqual(calls.map((c) => c.csrf), [STALE, LIVE]);
    assert.equal(getSessionCsrfToken(), LIVE);
  });

  it('recovers a bodyless DELETE too', async () => {
    registerOwner(LIVE);
    const calls = stubFetch(response(STALE_CSRF_REFUSAL, 403), new Response(null, { status: 204 }));

    const res = await apiFetch('/sales/order/lines/L1', { method: 'DELETE' });

    assert.equal(res.status, 204);
    assert.deepEqual(calls.map((c) => c.csrf), [STALE, LIVE]);
  });

  it('retries at most once: a second stale refusal is returned as is', async () => {
    const owner = registerOwner(LIVE);
    const calls = stubFetch(response(STALE_CSRF_REFUSAL, 403), response(STALE_CSRF_REFUSAL, 403));

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    assert.equal(res.status, 403);
    assert.equal(owner.recoveries(), 1);
    assert.equal(calls.length, 2);
  });

  it('does not retry an origin refusal, which no proof can fix', async () => {
    const owner = registerOwner(LIVE);
    const calls = stubFetch(response(ORIGIN_REFUSAL, 403));

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    assert.equal(res.status, 403);
    assert.equal(owner.recoveries(), 0);
    assert.equal(calls.length, 1);
  });

  it('returns the refusal when the owner cannot recover a proof (session changed or gone)', async () => {
    const owner = registerOwner(null);
    const calls = stubFetch(response(STALE_CSRF_REFUSAL, 403));

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    assert.equal(res.status, 403);
    assert.equal(owner.recoveries(), 1);
    assert.equal(calls.length, 1);
  });

  it('does not resend when the recovered proof is the one that was just refused', async () => {
    registerOwner(STALE);
    const calls = stubFetch(response(STALE_CSRF_REFUSAL, 403));

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    assert.equal(res.status, 403);
    assert.equal(calls.length, 1);
  });

  it('keeps the refusal body readable for the caller when it does not recover', async () => {
    registerOwner(null);
    stubFetch(response(STALE_CSRF_REFUSAL, 403));

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    assert.deepEqual(await res.json(), STALE_CSRF_REFUSAL);
  });

  it('shares one recovery between concurrent writes refused together', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const owner = registerOwner(async () => { await gate; return LIVE; });
    stubFetch(
      response(STALE_CSRF_REFUSAL, 403), response(STALE_CSRF_REFUSAL, 403),
      response({ ok: true }, 200), response({ ok: true }, 200),
    );

    const first = apiFetch('/sales/order/callout', { method: 'POST', body: '{"a":1}' });
    const second = apiFetch('/sales/order/evaluate-display', { method: 'POST', body: '{"b":2}' });
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    release();

    assert.deepEqual((await Promise.all([first, second])).map((r) => r.status), [200, 200]);
    assert.equal(owner.recoveries(), 1);
  });

  it('never recovers on a read', async () => {
    const owner = registerOwner(LIVE);
    stubFetch(response(STALE_CSRF_REFUSAL, 403));

    const res = await apiFetch('/sales/order');

    assert.equal(res.status, 403);
    assert.equal(owner.recoveries(), 0);
  });

  it('leaves a client without a recovering owner exactly as before', async () => {
    registerApiSession({ getToken: () => null, baseUrl: '' });
    const calls = stubFetch(response(STALE_CSRF_REFUSAL, 403));

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    assert.equal(res.status, 403);
    assert.equal(calls.length, 1);
  });
});
