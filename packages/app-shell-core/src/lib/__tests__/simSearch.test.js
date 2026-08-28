import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSimSearchEnvelope, simSearch } from '../simSearch.js';

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

describe('simSearch request', () => {
  /** Run `body` with `fetch`, `window` and `localStorage` stubbed, restoring them afterwards. */
  async function withBrowserStubs({ locale, respondWith }, body) {
    const saved = {
      fetch: globalThis.fetch,
      window: globalThis.window,
      localStorage: globalThis.localStorage,
    };
    const calls = [];
    globalThis.window = { location: { pathname: '/etendo/web/app/' } };
    globalThis.localStorage = { getItem: () => locale };
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => respondWith };
    };
    try {
      return await body(calls);
    } finally {
      globalThis.fetch = saved.fetch;
      globalThis.window = saved.window;
      globalThis.localStorage = saved.localStorage;
    }
  }

  const oneSpain = { item_0: { data: [{ id: 'C-1', name: 'Spain', similarity_percent: '100' }] } };

  it('sends the UI locale as Accept-Language so the backend can translate the term', async () => {
    // The endpoint rewrites a session-language term into its base-language name before
    // matching, and reads the session language off this header (NeoAuthenticator applies it
    // to the OBContext). Without the header the backend falls back to the AD user's default
    // language, so a Spanish UI driven by an en_US user resolves nothing — which is the exact
    // failure this header prevents. Every other NEO call sends it via `buildHeaders`; this
    // client builds its own headers, so it needs its own guard.
    await withBrowserStubs({ locale: 'es_ES', respondWith: oneSpain }, async (calls) => {
      const [result] = await simSearch({ token: 'tok', entityName: 'Country', items: ['España'] });
      assert.equal(result.id, 'C-1');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].options.headers['Accept-Language'], 'es_ES');
      assert.equal(calls[0].options.headers.Authorization, 'Bearer tok');
    });
  });

  it('sends the term verbatim — translation is the backend\'s job, not this client\'s', async () => {
    await withBrowserStubs({ locale: 'es_ES', respondWith: oneSpain }, async (calls) => {
      await simSearch({ token: 'tok', entityName: 'Country', items: ['España'] });
      const params = new URLSearchParams(calls[0].url.split('?')[1]);
      assert.deepEqual(JSON.parse(params.get('items')), ['España']);
      assert.equal(params.get('entityName'), 'Country');
    });
  });

  it('follows the locale when the user switches language', async () => {
    await withBrowserStubs({ locale: 'en_US', respondWith: oneSpain }, async (calls) => {
      await simSearch({ token: 'tok', entityName: 'Country', items: ['Spain'] });
      assert.equal(calls[0].options.headers['Accept-Language'], 'en_US');
    });
  });

  it('makes no request at all when token, entity or items are missing', async () => {
    await withBrowserStubs({ locale: 'es_ES', respondWith: oneSpain }, async (calls) => {
      assert.deepEqual(await simSearch({ token: '', entityName: 'Country', items: ['x'] }), [null]);
      assert.deepEqual(await simSearch({ token: 't', entityName: '', items: ['x'] }), [null]);
      assert.deepEqual(await simSearch({ token: 't', entityName: 'Country', items: [] }), []);
      assert.equal(calls.length, 0);
    });
  });
});
