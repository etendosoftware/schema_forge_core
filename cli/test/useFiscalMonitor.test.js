import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(__dirname, '../../tools/app-shell/src/windows/custom/fiscal-monitor/useFiscalMonitor.js'),
  'utf8',
);

// ── Re-implemented pure functions (not exported from source) ──────────────────

async function get(base, spec, entity, params, token) {
  const url = `${base}/${spec}/${encodeURIComponent(entity)}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${spec}/${entity} HTTP ${res.status}`);
  return (await res.json())?.response ?? {};
}

async function fetchCount(base, spec, entity, orgId, token) {
  const resp = await get(base, spec, entity, { organization: orgId, _limit: '1' }, token);
  return { totalCount: resp.totalRows ?? 0 };
}

// SII monitor constants (mirrored from source)
const SII_SPEC                 = 'sii-monitor';
const SII_EMITIDAS_ENTITY      = 'issuedInvoices';
const SII_RECIBIDAS_ENTITY     = 'receivedInvoices';
const SII_EMITIDAS_ANT_ENTITY  = 'issuedInvoices(previousPeriod)';
const SII_RECIBIDAS_ANT_ENTITY = 'receivedInvoices(previousPeriod)';

async function fetchSiiMonitorData(base, orgId, token) {
  const [emitidas, recibidas, emitidasAnt, recibidasAnt] = await Promise.all([
    fetchCount(base, SII_SPEC, SII_EMITIDAS_ENTITY,      orgId, token),
    fetchCount(base, SII_SPEC, SII_RECIBIDAS_ENTITY,     orgId, token),
    fetchCount(base, SII_SPEC, SII_EMITIDAS_ANT_ENTITY,  orgId, token),
    fetchCount(base, SII_SPEC, SII_RECIBIDAS_ANT_ENTITY, orgId, token),
  ]);
  return { issued: emitidas, received: recibidas, issuedPrevious: emitidasAnt, receivedPrevious: recibidasAnt };
}

// Verifactu monitor constants
const VF_SPEC              = 'monitor-verifactu';
const VF_ACEPTADAS_ENTITY  = 'facturasAceptadas';
const VF_PARCIAL_ENTITY    = 'facturasParcialmenteAceptadas';
const VF_RECHAZADAS_ENTITY = 'facturasRechazadas';
const VF_INVALIDAS_ENTITY  = 'facturasInválidas';

async function fetchVerifactuMonitorData(base, orgId, token) {
  const [accepted, partial, rejected, invalid] = await Promise.all([
    fetchCount(base, VF_SPEC, VF_ACEPTADAS_ENTITY,  orgId, token),
    fetchCount(base, VF_SPEC, VF_PARCIAL_ENTITY,    orgId, token),
    fetchCount(base, VF_SPEC, VF_RECHAZADAS_ENTITY, orgId, token),
    fetchCount(base, VF_SPEC, VF_INVALIDAS_ENTITY,  orgId, token),
  ]);
  return { accepted, partiallyAccepted: partial, rejected, invalid };
}

// TBAI constants
const TBAI_SPEC   = 'tbai-facturas-enviadas';
const TBAI_ENTITY = 'sincronización';

async function fetchCountByCriteria(base, spec, entity, orgId, field, value, token) {
  const params = {
    organization: orgId,
    _limit: '1',
    criteria: JSON.stringify([{ fieldName: field, operator: 'equals', value }]),
  };
  const resp = await get(base, spec, entity, params, token);
  return resp.totalRows ?? 0;
}

async function fetchTbaiData(base, orgId, token) {
  const [total, recibido, rechazado, error] = await Promise.all([
    get(base, TBAI_SPEC, TBAI_ENTITY, { organization: orgId, _limit: '1' }, token)
      .then(r => r.totalRows ?? 0),
    fetchCountByCriteria(base, TBAI_SPEC, TBAI_ENTITY, orgId, 'estado', 'Recibido', token),
    fetchCountByCriteria(base, TBAI_SPEC, TBAI_ENTITY, orgId, 'estado', 'Rechazado', token),
    fetchCountByCriteria(base, TBAI_SPEC, TBAI_ENTITY, orgId, 'estado', 'Error', token),
  ]);
  return { totalCount: total, recibidoCount: recibido, rechazadoCount: rechazado, errorCount: error };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('useFiscalMonitor source guards', () => {
  it('exports useFiscalMonitor as named export', () => {
    assert.match(src, /export function useFiscalMonitor/);
  });

  it('uses Promise.all multiple times (parallel fetching)', () => {
    const matches = src.match(/Promise\.all/g) ?? [];
    assert.ok(matches.length >= 2, `Expected at least 2 Promise.all calls, got ${matches.length}`);
  });

  it('imports and uses computeKpis', () => {
    assert.match(src, /import.*computeKpis.*from/);
    assert.match(src, /computeKpis\(/);
  });

  it('imports and uses detectProfile', () => {
    assert.match(src, /import.*detectProfile.*from/);
    assert.match(src, /detectProfile\(/);
  });

  it('exports SII spec and entity constants', () => {
    assert.match(src, /export\s*\{[^}]*SII_SPEC/);
    assert.match(src, /SII_EMITIDAS_ENTITY/);
    assert.match(src, /SII_RECIBIDAS_ENTITY/);
  });

  it('exports TBAI spec and entity constants', () => {
    assert.match(src, /export\s*\{[^}]*TBAI_SPEC/);
    assert.match(src, /TBAI_ENTITY/);
  });

  it('exports Verifactu spec and entity constants', () => {
    assert.match(src, /export\s*\{[^}]*VF_SPEC/);
    assert.match(src, /VF_ACEPTADAS_ENTITY/);
  });

  it('returns early with unconfigured profile when orgId is absent', () => {
    assert.match(src, /if \(!orgId\)/);
    assert.match(src, /profile:\s*['"]unconfigured['"]/);
  });
});

describe('get — URL construction', () => {
  it('URL-encodes the entity name', async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({ response: { totalRows: 5 } }) };
    };

    await get('/base', 'sii-monitor', 'issuedInvoices(previousPeriod)', { organization: 'org1' }, 'tok');

    assert.ok(
      capturedUrl.includes(encodeURIComponent('issuedInvoices(previousPeriod)')),
      `Expected URL-encoded entity in: ${capturedUrl}`,
    );
  });

  it('builds URL with spec and encoded entity in path', async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({ response: {} }) };
    };

    await get('/neo', 'my-spec', 'simpleEntity', { foo: 'bar' }, 'tok');

    assert.ok(capturedUrl.startsWith('/neo/my-spec/simpleEntity?'), `Unexpected URL: ${capturedUrl}`);
  });
});

describe('get — Authorization header', () => {
  it('sends Authorization: Bearer <token> header', async () => {
    let capturedHeaders;
    globalThis.fetch = async (_url, opts) => {
      capturedHeaders = opts.headers;
      return { ok: true, json: async () => ({ response: {} }) };
    };

    await get('/base', 'spec', 'entity', {}, 'the-token');

    assert.equal(capturedHeaders.Authorization, 'Bearer the-token');
  });
});

describe('get — response handling', () => {
  it('returns the response property from parsed JSON', async () => {
    const responseData = { totalRows: 42, data: [{ id: '1' }] };
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ response: responseData }),
    });

    const result = await get('/base', 'spec', 'entity', {}, 'tok');
    assert.deepEqual(result, responseData);
  });

  it('returns empty object when response property is missing', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({}),
    });

    const result = await get('/base', 'spec', 'entity', {}, 'tok');
    assert.deepEqual(result, {});
  });

  it('throws an Error with spec/entity name and status when response is not ok', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });

    await assert.rejects(
      () => get('/base', 'sii-monitor', 'issuedInvoices', {}, 'tok'),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /sii-monitor/);
        assert.match(err.message, /issuedInvoices/);
        assert.match(err.message, /404/);
        return true;
      },
    );
  });
});

describe('fetchCount', () => {
  it('returns { totalCount: N } with value from totalRows', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ response: { totalRows: 17 } }),
    });

    const result = await fetchCount('/base', 'sii-monitor', 'issuedInvoices', 'org1', 'tok');
    assert.deepEqual(result, { totalCount: 17 });
  });

  it('returns { totalCount: 0 } when totalRows is absent', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ response: {} }),
    });

    const result = await fetchCount('/base', 'sii-monitor', 'issuedInvoices', 'org1', 'tok');
    assert.deepEqual(result, { totalCount: 0 });
  });
});

describe('fetchSiiMonitorData — 4 parallel requests', () => {
  it('makes exactly 4 fetch calls (issued, received, issuedPrevious, receivedPrevious)', async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ response: { totalRows: 0 } }) };
    };

    await fetchSiiMonitorData('/base', 'org1', 'tok');

    assert.equal(calls.length, 4, `Expected 4 fetch calls, got ${calls.length}`);
  });

  it('fetches issued, received, issuedPrevious and receivedPrevious entities', async () => {
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(url);
      return { ok: true, json: async () => ({ response: { totalRows: 0 } }) };
    };

    const result = await fetchSiiMonitorData('/base', 'org1', 'tok');

    const encodedAnt = encodeURIComponent('issuedInvoices(previousPeriod)');
    assert.ok(urls.some(u => u.includes('issuedInvoices') && !u.includes(encodedAnt)), 'Missing issuedInvoices');
    assert.ok(urls.some(u => u.includes('receivedInvoices') && !u.includes('previousPeriod')), 'Missing receivedInvoices');
    assert.ok(urls.some(u => u.includes(encodedAnt)), 'Missing issuedPrevious (previousPeriod)');
    assert.ok(
      urls.some(u => u.includes(encodeURIComponent('receivedInvoices(previousPeriod)'))),
      'Missing receivedPrevious (previousPeriod)',
    );

    assert.ok('issued' in result);
    assert.ok('received' in result);
    assert.ok('issuedPrevious' in result);
    assert.ok('receivedPrevious' in result);
  });
});

describe('fetchVerifactuMonitorData — 4 parallel requests', () => {
  it('makes exactly 4 fetch calls (accepted, partiallyAccepted, rejected, invalid)', async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ response: { totalRows: 0 } }) };
    };

    await fetchVerifactuMonitorData('/base', 'org1', 'tok');

    assert.equal(calls.length, 4, `Expected 4 fetch calls, got ${calls.length}`);
  });

  it('fetches accepted, partiallyAccepted, rejected and invalid entities', async () => {
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(url);
      return { ok: true, json: async () => ({ response: { totalRows: 0 } }) };
    };

    const result = await fetchVerifactuMonitorData('/base', 'org1', 'tok');

    assert.ok(urls.some(u => u.includes('facturasAceptadas')), 'Missing facturasAceptadas');
    assert.ok(
      urls.some(u => u.includes(encodeURIComponent('facturasParcialmenteAceptadas'))),
      'Missing facturasParcialmenteAceptadas',
    );
    assert.ok(urls.some(u => u.includes('facturasRechazadas')), 'Missing facturasRechazadas');
    assert.ok(
      urls.some(u => u.includes(encodeURIComponent('facturasInválidas')) || u.includes('facturasInv')),
      'Missing facturasInválidas',
    );

    assert.ok('accepted' in result);
    assert.ok('partiallyAccepted' in result);
    assert.ok('rejected' in result);
    assert.ok('invalid' in result);
  });
});

describe('fetchTbaiData — criteria filter', () => {
  it('sends criteria filter with estado field for Recibido/Rechazado/Error counts', async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ response: { totalRows: 3 } }) };
    };

    const result = await fetchTbaiData('/base', 'org1', 'tok');

    // 1 total + 3 criteria = 4 calls
    assert.equal(calls.length, 4, `Expected 4 fetch calls, got ${calls.length}`);

    const criteriaCalls = calls.filter(u => u.includes('criteria'));
    assert.equal(criteriaCalls.length, 3, 'Expected 3 calls with criteria param');

    const allCriteria = criteriaCalls.map(u => decodeURIComponent(u));
    assert.ok(allCriteria.some(u => u.includes('Recibido')), 'Missing Recibido criteria');
    assert.ok(allCriteria.some(u => u.includes('Rechazado')), 'Missing Rechazado criteria');
    assert.ok(allCriteria.some(u => u.includes('Error')), 'Missing Error criteria');

    assert.ok('totalCount' in result);
    assert.ok('recibidoCount' in result);
    assert.ok('rechazadoCount' in result);
    assert.ok('errorCount' in result);
  });

  it('criteria filter uses estado as the fieldName', async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ response: { totalRows: 0 } }) };
    };

    await fetchTbaiData('/base', 'org1', 'tok');

    const criteriaCalls = calls.filter(u => u.includes('criteria'));
    for (const u of criteriaCalls) {
      const decoded = decodeURIComponent(u);
      assert.ok(decoded.includes('"fieldName":"estado"'), `Expected fieldName:estado in: ${decoded}`);
    }
  });
});
