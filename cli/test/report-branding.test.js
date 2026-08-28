/**
 * Tests for hydrateDocumentBranding in report-branding.js.
 *
 * This module moved here (ETP-5013) from the functional repo's Vite dev
 * plugin (`tools/app-shell/vite-plugins/report-branding.js`, now deleted)
 * after ETP-4998 shipped the company-logo feature ONLY in that dev plugin.
 * `tools/report-server/server.js` never imported it, never expanded the
 * `{{> document-branding}}` partial, and never injected `org_logo_id` into
 * the header SQL — every `print-*` document rendered through the production
 * server threw "The partial document-branding could not be found" while dev
 * looked correct. Same failure class as ETP-4898/4899/4908 (see
 * report-i18n.test.js's docstring): code living only in a Vite plugin never
 * reaches production, only a shared module reliably does.
 *
 * Exercises the REAL shared function — both the report-server
 * (tools/report-server/server.js) and the functional repo's dev plugin
 * (report-api.js) import this module directly, never a local copy.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { hydrateDocumentBranding, resolveCompanyLogoDataUrl } from '../src/report-branding.js';

function response({ ok = true, contentType = 'image/png', bytes = [1, 2, 3] } = {}) {
  return {
    ok,
    headers: { get: (name) => (name === 'content-type' ? contentType : null) },
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  };
}

describe('hydrateDocumentBranding — document reports (header.org_logo_id)', () => {
  it('embeds the organization image returned by the authenticated NEO endpoint', async () => {
    const result = await hydrateDocumentBranding(
      { org_name: 'Acme', org_logo_id: 'img-1' },
      {
        authToken: 'token',
        etendoBase: 'http://etendo.test/etendo',
        fetchImpl: async (url, options) => {
          assert.equal(url, 'http://etendo.test/etendo/sws/neo/image/img-1');
          assert.equal(options.headers.Authorization, 'Bearer token');
          return response({ contentType: 'image/svg+xml', bytes: [60, 115, 118, 103, 62] });
        },
      },
    );

    assert.equal(result.companyLogoDataUrl, 'data:image/svg+xml;base64,PHN2Zz4=');
    // The rest of the header must be preserved, not replaced.
    assert.equal(result.org_name, 'Acme');
    assert.equal(result.org_logo_id, 'img-1');
  });

  it('URL-encodes the image id (it can contain characters unsafe for a path segment)', async () => {
    let capturedUrl;
    await hydrateDocumentBranding(
      { org_logo_id: 'a/b c' },
      {
        authToken: 'token',
        etendoBase: 'http://etendo.test/etendo',
        fetchImpl: async (url) => {
          capturedUrl = url;
          return response();
        },
      },
    );
    assert.equal(capturedUrl, 'http://etendo.test/etendo/sws/neo/image/a%2Fb%20c');
  });

  it('defaults etendoBase to http://localhost:8080/etendo when not supplied', async () => {
    let capturedUrl;
    await hydrateDocumentBranding(
      { org_logo_id: 'img-1' },
      {
        authToken: 'token',
        fetchImpl: async (url) => {
          capturedUrl = url;
          return response();
        },
      },
    );
    assert.equal(capturedUrl, 'http://localhost:8080/etendo/sws/neo/image/img-1');
  });

  it('keeps the report printable when branding is unavailable (image fetch not ok)', async () => {
    const header = { org_name: 'Acme', org_logo_id: 'missing' };
    const result = await hydrateDocumentBranding(header, {
      authToken: 'token',
      fetchImpl: async () => response({ ok: false }),
    });
    assert.deepEqual(result, header);
  });

  it('keeps the report printable when the image fetch throws', async () => {
    const header = { org_name: 'Acme', org_logo_id: 'img-1' };
    const result = await hydrateDocumentBranding(header, {
      authToken: 'token',
      fetchImpl: async () => { throw new Error('network down'); },
    });
    assert.deepEqual(result, header, 'a network failure must degrade to the original header, not throw');
  });

  it('returns the header unchanged when there is no org_logo_id at all', async () => {
    const header = { org_name: 'Acme' };
    let fetchCalled = false;
    const result = await hydrateDocumentBranding(header, {
      authToken: 'token',
      fetchImpl: async () => { fetchCalled = true; return response(); },
    });
    assert.deepEqual(result, header);
    assert.equal(fetchCalled, false, 'must not attempt a fetch when there is nothing to fetch');
  });

  it('returns the header unchanged when there is no authToken', async () => {
    const header = { org_name: 'Acme', org_logo_id: 'img-1' };
    let fetchCalled = false;
    const result = await hydrateDocumentBranding(header, {
      fetchImpl: async () => { fetchCalled = true; return response(); },
    });
    assert.deepEqual(result, header);
    assert.equal(fetchCalled, false, 'must not attempt an unauthenticated NEO image fetch');
  });

  it('returns undefined/null header input unchanged rather than throwing', async () => {
    assert.equal(await hydrateDocumentBranding(null, { authToken: 'token' }), null);
    assert.equal(await hydrateDocumentBranding(undefined, { authToken: 'token' }), undefined);
  });
});

describe('hydrateDocumentBranding — listing reports (synthetic {org_logo_id} object)', () => {
  // Listing reports (report-general-ledger, balance-sheet, etc.) have no
  // `header` object at all — the engines resolve org_logo_id from the report's
  // own `orgId` filter and pass a synthetic `{ org_logo_id }` object here. The
  // function must not care where org_logo_id came from — only that it exists.
  it('embeds the logo for a bare {org_logo_id} object with no other document fields', async () => {
    const result = await hydrateDocumentBranding(
      { org_logo_id: 'img-listing' },
      {
        authToken: 'token',
        etendoBase: 'http://etendo.test/etendo',
        fetchImpl: async (url) => {
          assert.equal(url, 'http://etendo.test/etendo/sws/neo/image/img-listing');
          return response({ contentType: 'image/png', bytes: [1, 2, 3] });
        },
      },
    );
    assert.equal(result.companyLogoDataUrl, 'data:image/png;base64,AQID');
  });

  it('returns an empty object unchanged when org_logo_id resolves to null (no image configured)', async () => {
    const result = await hydrateDocumentBranding({ org_logo_id: null }, { authToken: 'token' });
    assert.deepEqual(result, { org_logo_id: null });
  });
});

describe('resolveCompanyLogoDataUrl — listing report two-step lookup (ETP-5013 follow-up)', () => {
  // Mocks `pool.query(sql, params)` for the two queries this function issues,
  // recording every call so the two-step orgId → client-fallback sequencing
  // can be asserted precisely (the fallback must be SKIPPED once the org
  // query already found a logo — every unnecessary DB round trip on this
  // path runs once per rendered listing report).
  function createMockPool({ orgLogoId, clientLogoId } = {}) {
    const calls = [];
    return {
      calls,
      query: async (sql, params) => {
        calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
        if (sql.includes('WHERE ad_org_id = $1')) {
          return { rows: orgLogoId !== undefined ? [{ org_logo_id: orgLogoId }] : [] };
        }
        if (sql.includes('WHERE ad_client_id = $1')) {
          return { rows: clientLogoId !== undefined ? [{ org_logo_id: clientLogoId }] : [] };
        }
        throw new Error(`unexpected query: ${sql}`);
      },
    };
  }

  let originalFetch;
  function stubImageFetch(bytes = [1, 2, 3]) {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    });
  }
  function restoreFetch() {
    globalThis.fetch = originalFetch;
  }

  it('returns undefined without querying anything when there is no clientId', async () => {
    const pool = createMockPool({ orgLogoId: 'org-logo' });
    const result = await resolveCompanyLogoDataUrl(pool, { orgId: 'ORG1', authToken: 'token' });
    assert.equal(result, undefined);
    assert.equal(pool.calls.length, 0);
  });

  it('prefers the org-scoped logo when orgId is given and that org has one configured', async () => {
    stubImageFetch();
    try {
      const pool = createMockPool({ orgLogoId: 'org-logo', clientLogoId: 'client-logo' });
      const result = await resolveCompanyLogoDataUrl(pool, { clientId: 'C1', orgId: 'ORG1', authToken: 'token' });
      assert.equal(result, 'data:image/png;base64,AQID');
      assert.equal(pool.calls.length, 1, 'must not fall back to the client-wide query once the org query succeeds');
      assert.deepEqual(pool.calls[0].params, ['ORG1']);
    } finally { restoreFetch(); }
  });

  it('falls back to any org of the same client when orgId is absent (Inventory Stock Report, Order Not Shipped)', async () => {
    stubImageFetch();
    try {
      const pool = createMockPool({ clientLogoId: 'client-logo' });
      const result = await resolveCompanyLogoDataUrl(pool, { clientId: 'C1', authToken: 'token' });
      assert.equal(result, 'data:image/png;base64,AQID');
      assert.equal(pool.calls.length, 1, 'the org query must be skipped entirely when there is no orgId to scope it by');
      assert.deepEqual(pool.calls[0].params, ['C1']);
    } finally { restoreFetch(); }
  });

  it('falls back to the client-wide logo when the given org has none configured', async () => {
    stubImageFetch();
    try {
      const pool = createMockPool({ orgLogoId: null, clientLogoId: 'client-logo' });
      const result = await resolveCompanyLogoDataUrl(pool, { clientId: 'C1', orgId: 'ORG1', authToken: 'token' });
      assert.equal(result, 'data:image/png;base64,AQID');
      assert.equal(pool.calls.length, 2, 'must query both the org row and the client-wide fallback');
      assert.deepEqual(pool.calls[1].params, ['C1']);
    } finally { restoreFetch(); }
  });

  it('returns undefined when neither the org nor any org of the client has a logo configured', async () => {
    const pool = createMockPool({ orgLogoId: null, clientLogoId: null });
    const result = await resolveCompanyLogoDataUrl(pool, { clientId: 'C1', orgId: 'ORG1', authToken: 'token' });
    assert.equal(result, undefined);
  });

  it('returns undefined without a network fetch when there is no authToken (fail-soft, same as hydrateDocumentBranding)', async () => {
    let fetchCalled = false;
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalled = true; return { ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => new Uint8Array().buffer }; };
    try {
      const pool = createMockPool({ orgLogoId: 'org-logo' });
      const result = await resolveCompanyLogoDataUrl(pool, { clientId: 'C1', orgId: 'ORG1' });
      assert.equal(result, undefined);
      assert.equal(fetchCalled, false);
    } finally { restoreFetch(); }
  });
});
