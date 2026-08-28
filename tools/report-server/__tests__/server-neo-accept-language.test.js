/**
 * ETP-5013 — the render's locale must reach the NEO backend as `Accept-Language`.
 *
 * The Tax Report's COUNTRY column rendered in English regardless of the language
 * the report was generated in. Half of that was a missing translation join on the
 * Java side; the other half was here: the report engines sent ONLY `Content-Type`
 * and `Authorization` on the NEO fetch, so the backend had no idea which language
 * the render was for and fell back to the Etendo *user's* `default_ad_language`.
 * The same report therefore came out in Spanish for one user and English for
 * another (verified against the real DB: `GOAdmin` is es_ES, `GOuser` is en_US).
 *
 * `server.js` starts an HTTP listener on import, so — following the same
 * replication convention as `server.test.js` and `server-render.test.js` — the
 * NEO branch of its private `fetchReportData` is replicated below with an
 * injectable `fetch` and an injectable contract reader. The replica is pinned to
 * the real thing by the `server.js source` guards at the bottom, which assert the
 * exact header literal and the `/render` call site that feeds it.
 *
 * The identical change lives in the dev-time vite plugin
 * (`schema_forge/tools/app-shell/vite-plugins/report-api.js`) with its own
 * mirrored test file. The two engines are hand-maintained copies by design, and
 * a header sent only by the dev plugin would translate reports on developer
 * machines while silently leaving every deployed server rendering the wrong
 * language — which is precisely the failure mode this change exists to prevent.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SERVER_SRC = readFileSync(fileURLToPath(new URL('../server.js', import.meta.url)), 'utf8');

const ETENDO_URL = 'http://localhost:8080/etendo';

// --- Replicated NEO branch of fetchReportData (server.js) --------------------
// Byte-identical in behaviour to the real one; the `server.js source` suite
// below fails if the original drifts away from this shape.

async function fetchNeoReportData(contract, { authToken, params = {}, locale } = {}, fetchImpl) {
  if (!authToken) throw new Error('No auth token');
  const neoUrl = `${ETENDO_URL}${contract.neo.endpoint}`;
  const neoBody = { ...contract.neo.body, ...params };
  const neoRes = await fetchImpl(neoUrl, {
    method: contract.neo.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      ...(locale ? { 'Accept-Language': locale } : {}),
    },
    body: JSON.stringify(neoBody),
  });
  if (!neoRes.ok) {
    const text = await neoRes.text().catch(() => '');
    throw new Error(`NEO ${neoRes.status}: ${text.slice(0, 200)}`);
  }
  return neoRes.json();
}

const CONTRACT = {
  reportId: 'tax-report',
  source: 'neo',
  neo: { endpoint: '/sws/neo/tax-report', method: 'POST', body: {}, dataPath: 'response.data' },
};

function makeFetchSpy() {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok: true, status: 200, json: async () => ({ response: { data: [] } }), text: async () => '' };
  };
  impl.calls = calls;
  impl.lastHeaders = () => calls.at(-1).init.headers;
  return impl;
}

async function headersFor(opts) {
  const fetchImpl = makeFetchSpy();
  await fetchNeoReportData(CONTRACT, { authToken: 'test-token', ...opts }, fetchImpl);
  return fetchImpl.lastHeaders();
}

describe('report-server NEO fetch — Accept-Language (ETP-5013)', () => {
  describe('locale forwarding', () => {
    it('sends the supplied locale as Accept-Language', async () => {
      const headers = await headersFor({ locale: 'es_ES' });
      assert.equal(headers['Accept-Language'], 'es_ES');
    });

    it('forwards whatever locale it was given, not a fixed one', async () => {
      // The bug was not "always English" — it was "always the *user's* language".
      // Both directions must therefore be provably driven by the caller.
      for (const locale of ['es_ES', 'en_US', 'fr_FR']) {
        const headers = await headersFor({ locale });
        assert.equal(headers['Accept-Language'], locale);
      }
    });
  });

  describe('absent locale', () => {
    for (const [name, locale] of [['undefined', undefined], ['omitted', null], ['empty string', '']]) {
      it(`omits the Accept-Language KEY entirely when the locale is ${name}`, async () => {
        // The key must be ABSENT, not present-and-undefined:
        // `{ 'Accept-Language': undefined }` serializes to the literal string
        // "undefined" over the wire, which the backend would then try to parse
        // as a language code. That is exactly what the conditional spread avoids.
        const headers = locale === null
          ? await headersFor({})
          : await headersFor({ locale });
        assert.equal('Accept-Language' in headers, false,
          `Accept-Language must not be present at all, got: ${JSON.stringify(headers)}`);
        assert.equal(Object.keys(headers).includes('Accept-Language'), false);
      });
    }
  });

  describe('pre-existing headers (regression guard)', () => {
    it('still sends Content-Type and Authorization alongside Accept-Language', async () => {
      const headers = await headersFor({ locale: 'es_ES' });
      assert.equal(headers['Content-Type'], 'application/json');
      assert.equal(headers.Authorization, 'Bearer test-token');
      assert.equal(headers['Accept-Language'], 'es_ES');
    });

    it('still sends Content-Type and Authorization when no locale is supplied', async () => {
      const headers = await headersFor({});
      assert.deepEqual(Object.keys(headers), ['Content-Type', 'Authorization']);
      assert.equal(headers.Authorization, 'Bearer test-token');
    });

    it('leaves the method and body of the NEO call untouched', async () => {
      const fetchImpl = makeFetchSpy();
      await fetchNeoReportData(CONTRACT, { authToken: 't', params: { dateFrom: '2026-01-01' }, locale: 'es_ES' }, fetchImpl);
      const { url, init } = fetchImpl.calls.at(-1);
      assert.equal(url, `${ETENDO_URL}/sws/neo/tax-report`);
      assert.equal(init.method, 'POST');
      assert.deepEqual(JSON.parse(init.body), { dateFrom: '2026-01-01' });
    });
  });

  describe('server.js source', () => {
    it('builds the header with a conditional spread, never an unconditional key', () => {
      assert.match(SERVER_SRC, /\.\.\.\(locale \? \{ 'Accept-Language': locale \} : \{\}\)/);
      assert.doesNotMatch(SERVER_SRC, /^\s*'Accept-Language':\s*locale,\s*$/m,
        "an unconditional key would send 'Accept-Language: undefined' when no locale is set");
    });

    it('accepts locale in fetchReportData\'s options', () => {
      assert.match(SERVER_SRC, /async function fetchReportData\(reportId, \{[^)]*locale[^)]*\}/);
    });

    it('threads locale into fetchReportData at the /render call site', () => {
      // The piece most likely to be silently dropped in a refactor: the header
      // code would still look correct while receiving `undefined` forever.
      assert.match(SERVER_SRC,
        /fetchReportData\(reportId, \{ limit, authToken, params, locale \}\)/);
    });

    it('deliberately does NOT pass a locale at the /data call site', () => {
      // /data is a raw-data endpoint with no render/locale concept; the asymmetry
      // is intentional and is what keeps the "absent key" branch alive in
      // production, not just in this test file.
      assert.match(SERVER_SRC, /fetchReportData\(reportId, \{ limit, authToken \}\)/);
    });

    it('keeps Content-Type and Authorization in the NEO headers literal', () => {
      const literal = SERVER_SRC.match(/headers: \{\s*'Content-Type': 'application\/json',\s*'Authorization': `Bearer \$\{authToken\}`,[\s\S]*?\},/);
      assert.ok(literal, 'could not locate the NEO headers literal — did it get restructured?');
      assert.ok(literal[0].includes("'Accept-Language': locale"),
        'the NEO headers literal lost its Accept-Language entry');
    });
  });
});
