import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseSimSearchEnvelope, simSearch } from '../simSearch.js';
import {
  CREDENTIAL_MODES,
  setSessionCredentials,
  resetSessionCredentials,
} from '../../auth/sessionCredentials.js';

describe('parseSimSearchEnvelope', () => {
  it('returns array of nulls when envelope is missing', () => {
    assert.deepEqual(parseSimSearchEnvelope(null, 3), [null, null, null]);
    assert.deepEqual(parseSimSearchEnvelope(undefined, 2), [null, null]);
    assert.deepEqual(parseSimSearchEnvelope({}, 2), [null, null]);
  });

  it('returns nulls when envelope is a non-object primitive (guard clause)', () => {
    assert.deepEqual(parseSimSearchEnvelope('not an object', 1), [null]);
    assert.deepEqual(parseSimSearchEnvelope(42, 1), [null]);
  });

  it('returns nulls when envelope is an array (typeof object, but no item_N keys)', () => {
    // Arrays pass `typeof envelope === 'object'` so the guard clause does not
    // short-circuit; each `envelope[`item_${i}`]` lookup is simply undefined,
    // which falls through to the same null-per-item result.
    assert.deepEqual(parseSimSearchEnvelope(['array', 'is', 'typeof-object'], 2), [null, null]);
  });

  it('parses a single-item match envelope', () => {
    const envelope = {
      item_0: { data: [{ id: 'P-1', name: 'Widget', similarity_percent: '85' }] },
    };
    const result = parseSimSearchEnvelope(envelope, 1);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'P-1');
    assert.equal(result[0].name, 'Widget');
    assert.equal(result[0].similarityPercent, '85');
  });

  it('preserves similarity_percent === 0 (does not coerce to null)', () => {
    const envelope = {
      item_0: { data: [{ id: 'P-2', name: 'Zero match', similarity_percent: 0 }] },
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.similarityPercent, 0);
  });

  it('falls back to _identifier or id when name is missing', () => {
    const envelope = {
      item_0: { data: [{ id: 'P-3', _identifier: 'IDENT-3' }] },
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.name, 'IDENT-3');
  });

  it('returns null for items with no data', () => {
    const envelope = {
      item_0: { data: [{ id: 'P-1' }] },
      item_1: { data: [] },
    };
    const result = parseSimSearchEnvelope(envelope, 2);
    assert.equal(result[0]?.id, 'P-1');
    assert.equal(result[1], null);
  });

  it('reads data from response.data when top-level data is missing', () => {
    const envelope = {
      item_0: { response: { data: [{ id: 'P-9', name: 'Nested' }] } },
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.id, 'P-9');
  });

  it('pads missing items with null', () => {
    const envelope = { item_0: { data: [{ id: 'A' }] } };
    const result = parseSimSearchEnvelope(envelope, 3);
    assert.equal(result.length, 3);
    assert.equal(result[1], null);
    assert.equal(result[2], null);
  });

  it('includes every match in .candidates, best-first', () => {
    const envelope = {
      item_0: {
        data: [
          { id: 'C-1', name: 'Kilogramo', similarity_percent: '92' },
          { id: 'C-2', name: 'Kilograma', similarity_percent: '78' },
        ],
      },
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.candidates.length, 2);
    assert.deepEqual(first.candidates[0], { id: 'C-1', name: 'Kilogramo', similarityPercent: '92' });
    assert.deepEqual(first.candidates[1], { id: 'C-2', name: 'Kilograma', similarityPercent: '78' });
  });

  it('top-level id/name/similarityPercent mirror candidates[0] (back-compat)', () => {
    const envelope = {
      item_0: {
        data: [
          { id: 'C-1', name: 'Kilogramo', similarity_percent: '92' },
          { id: 'C-2', name: 'Kilograma', similarity_percent: '78' },
        ],
      },
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.id, first.candidates[0].id);
    assert.equal(first.name, first.candidates[0].name);
    assert.equal(first.similarityPercent, first.candidates[0].similarityPercent);
  });

  it('a null result (no data) has no candidates to read', () => {
    const envelope = { item_0: { data: [] } };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first, null);
  });

  it('regression: strips the real webhook\'s trailing "%" so downstream Number() parsing is never NaN', () => {
    // A live capture against the actual SimSearch webhook returned
    // `similarity_percent: "100.0000%"` — a formatted display string, not the
    // bare-digit string ("85") every other test here uses. classifyCandidates
    // does Number(similarityPercent) to compare against its auto-resolve
    // threshold; Number("100.0000%") is NaN, and NaN compared with `<` is
    // always false, so every real candidate silently passed as "confident
    // enough" regardless of actual match quality.
    const envelope = {
      item_0: { data: [{ id: '119', name: 'Argentina', similarity_percent: '100.0000%' }] },
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.similarityPercent, '100.0000');
    assert.equal(Number(first.similarityPercent), 100);
  });

  it('regression: a bare numeric string (no "%") is left byte-for-byte unchanged', () => {
    const envelope = {
      item_0: { data: [{ id: 'P-1', name: 'Widget', similarity_percent: '85' }] },
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.similarityPercent, '85');
  });
});

/**
 * ETP-4576 regression guard.
 *
 * `simSearch` used to start with `if (!token || ...) return nulls` and build its
 * own `Authorization: Bearer`. Under a cookie session no caller holds a token,
 * so that guard cancelled every similarity search and returned the same
 * all-nulls array a genuine no-match produces — indistinguishable from "nothing
 * matched", with no request on the wire and nothing logged. Downstream that
 * surfaced as valid CSV rows needing manual review.
 *
 * The cookie case is the one that regresses if the guard ever comes back, so it
 * is asserted on behaviour (a request IS issued) rather than on the source.
 */
describe('simSearch credential handling', () => {
  const realFetch = globalThis.fetch;
  const hadWindow = 'window' in globalThis;
  const realWindow = globalThis.window;
  let calls;

  beforeEach(() => {
    calls = [];
    // A path containing `/web/` — the real shape in the browser. It matters:
    // detectEtendoBase only falls through to `import.meta.env` when the segment
    // is absent, and `import.meta.env` does not exist under `node --test`.
    globalThis.window = { location: { pathname: '/etendo/web/com.etendoerp.go/index.html' } };
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ item_0: { data: [] } }) };
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (hadWindow) globalThis.window = realWindow;
    else delete globalThis.window;
    resetSessionCredentials();
  });

  it('issues the request under a cookie session, where no token is ever held', async () => {
    setSessionCredentials({ mode: CREDENTIAL_MODES.cookie, csrfToken: 'c' });
    await simSearch({ entityName: 'Country', items: ['Spain'] });
    assert.equal(calls.length, 1, 'a cookie session must not cancel the search');
    assert.equal(calls[0].init.credentials, 'include');
    assert.equal(calls[0].init.headers.Authorization, undefined);
  });

  it('carries the bearer under a bearer session', async () => {
    setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tok' });
    await simSearch({ entityName: 'Country', items: ['Spain'] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  });

  it('sends no Content-Type — it is a bodyless GET and would force a preflight', async () => {
    setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tok' });
    await simSearch({ entityName: 'Country', items: ['Spain'] });
    assert.equal(calls[0].init.headers['Content-Type'], undefined);
  });

  it('still short-circuits on a missing entity or an empty item list', async () => {
    setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tok' });
    assert.deepEqual(await simSearch({ entityName: '', items: ['Spain'] }), [null]);
    assert.deepEqual(await simSearch({ entityName: 'Country', items: [] }), []);
    assert.equal(calls.length, 0, 'neither case should reach the network');
  });
});
