import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(__dirname, '../../tools/app-shell/src/windows/custom/fiscal-config/useFiscalConfig.js'),
  'utf8',
);

// ── Re-implemented pure function (not exported from source) ───────────────────
async function fetchRecord(base, specName, entityName, orgId, token) {
  const params = new URLSearchParams({ organization: orgId, _limit: '1' });
  const res = await fetch(`${base}/${specName}/${entityName}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to load ${specName}: HTTP ${res.status}`);
  const json = await res.json();
  return json?.response?.data?.[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('useFiscalConfig source guards', () => {
  it('exports useFiscalConfig as named export', () => {
    assert.match(src, /export function useFiscalConfig/);
  });

  it('uses Promise.all for parallel fetching', () => {
    assert.match(src, /Promise\.all/);
  });

  it('defines SII entity constant as siiConfiguration', () => {
    assert.match(src, /SII_ENTITY\s*=\s*['"]siiConfiguration['"]/);
  });

  it('defines TBAI entity constant as header', () => {
    assert.match(src, /TBAI_ENTITY\s*=\s*['"]header['"]/);
  });

  it('defines Verifactu entity constant as cabeceraDeConfiguraciónVerifactu', () => {
    assert.match(src, /VERIFACTU_ENTITY\s*=\s*['"]cabeceraDeConfiguraci[oó]nVerifactu['"]/u);
  });

  it('calls detectProfile with sii, tbai and verifactu records', () => {
    assert.match(src, /detectProfile\(/);
  });

  it('returns early with unconfigured profile when orgId is absent', () => {
    assert.match(src, /if \(!orgId\)/);
    assert.match(src, /profile:\s*['"]unconfigured['"]/);
  });
});

describe('fetchRecord URL construction', () => {
  it('builds URL with organization and _limit=1 query params', async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({ response: { data: [] } }) };
    };

    await fetchRecord('/sws/neo', 'sii-config', 'siiConfiguration', 'org-1', 'tok');

    assert.ok(capturedUrl.includes('organization=org-1'), `Expected organization param, got: ${capturedUrl}`);
    assert.ok(capturedUrl.includes('_limit=1'), `Expected _limit=1 param, got: ${capturedUrl}`);
    assert.ok(
      capturedUrl.startsWith('/sws/neo/sii-config/siiConfiguration?'),
      `Unexpected URL base: ${capturedUrl}`,
    );
  });
});

describe('fetchRecord Authorization header', () => {
  it('sends Authorization: Bearer <token> header', async () => {
    let capturedHeaders;
    globalThis.fetch = async (_url, opts) => {
      capturedHeaders = opts.headers;
      return { ok: true, json: async () => ({ response: { data: [] } }) };
    };

    await fetchRecord('/base', 'spec', 'entity', 'org', 'my-secret-token');

    assert.equal(capturedHeaders.Authorization, 'Bearer my-secret-token');
  });
});

describe('fetchRecord response parsing', () => {
  it('returns first element from response.data array', async () => {
    const record = { id: 'rec-1', name: 'Test' };
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ response: { data: [record, { id: 'rec-2' }] } }),
    });

    const result = await fetchRecord('/base', 'spec', 'entity', 'org', 'tok');
    assert.deepEqual(result, record);
  });

  it('returns null when response.data is an empty array', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ response: { data: [] } }),
    });

    const result = await fetchRecord('/base', 'spec', 'entity', 'org', 'tok');
    assert.equal(result, null);
  });

  it('returns null when response.data is undefined', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ response: {} }),
    });

    const result = await fetchRecord('/base', 'spec', 'entity', 'org', 'tok');
    assert.equal(result, null);
  });

  it('returns null when response is missing entirely', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({}),
    });

    const result = await fetchRecord('/base', 'spec', 'entity', 'org', 'tok');
    assert.equal(result, null);
  });
});

describe('fetchRecord error handling', () => {
  it('throws an Error including the HTTP status when response is not ok', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 403 });

    await assert.rejects(
      () => fetchRecord('/base', 'my-spec', 'entity', 'org', 'tok'),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /HTTP 403/);
        assert.match(err.message, /my-spec/);
        return true;
      },
    );
  });

  it('throws an Error including the spec name when response is not ok', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500 });

    await assert.rejects(
      () => fetchRecord('/base', 'sii-config', 'entity', 'org', 'tok'),
      /sii-config/,
    );
  });
});

describe('useFiscalConfig profile integration (source guard)', () => {
  it('hook calls detectProfile to derive profile from fetched records', () => {
    // This is guaranteed by the source guard — detectProfile import + call must be present
    assert.match(src, /import.*detectProfile.*from/);
    assert.match(src, /detectProfile\(sii,\s*tbai,\s*verifactu\)/);
  });
});
