import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  listAttachments,
  fetchAttachmentBlobUrl,
} from '../listAttachments.js';

describe('listAttachments', () => {
  let originalFetch;
  let originalWindow;
  let lastUrl;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalWindow = globalThis.window;
    globalThis.window = { location: { pathname: '/web/com.etendoerp.go/index.html' } };
    lastUrl = null;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });

  it('returns [] when required params are missing', async () => {
    assert.deepEqual(await listAttachments({}), []);
    assert.deepEqual(await listAttachments({ token: 'tok', tableName: 'C_Invoice' }), []);
    assert.deepEqual(await listAttachments({ token: 'tok', recordId: 'X' }), []);
  });

  it('GETs /sws/neo/attachments/{table}/{id}', async () => {
    globalThis.fetch = async (url) => {
      lastUrl = String(url);
      return {
        ok: true,
        json: async () => ({ items: [{ id: 'A1', name: 'doc.pdf' }] }),
      };
    };
    const result = await listAttachments({
      token: 'tok', tableName: 'C_Invoice', recordId: 'INV-1',
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'A1');
    assert.match(lastUrl, /\/sws\/neo\/attachments\/C_Invoice\/INV-1$/);
  });

  it('strips spec segment from apiBaseUrl to find the root proxy base', async () => {
    globalThis.fetch = async (url) => {
      lastUrl = String(url);
      return { ok: true, json: async () => ({ items: [] }) };
    };
    await listAttachments({
      token: 'tok',
      tableName: 'C_Invoice',
      recordId: 'INV-1',
      apiBaseUrl: 'http://host/sws/neo/purchase-invoice',
    });
    assert.match(lastUrl, /^http:\/\/host\/sws\/neo\/attachments\/C_Invoice\/INV-1$/);
  });

  it('accepts items / response.data / data envelopes', async () => {
    const shapes = [
      { items: [{ id: 'A1' }] },
      { response: { data: [{ id: 'A1' }] } },
      { data: [{ id: 'A1' }] },
      [{ id: 'A1' }],
    ];
    for (const shape of shapes) {
      globalThis.fetch = async () => ({ ok: true, json: async () => shape });
      const result = await listAttachments({
        token: 'tok', tableName: 'C_Invoice', recordId: 'INV-1',
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'A1');
    }
  });

  it('drops rows without id', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ items: [{ id: 'A1' }, { name: 'no-id.pdf' }, null] }),
    });
    const result = await listAttachments({
      token: 'tok', tableName: 'C_Invoice', recordId: 'INV-1',
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'A1');
  });

  it('returns [] on non-2xx response', async () => {
    globalThis.fetch = async () => ({
      ok: false, status: 500, json: async () => ({ error: 'boom' }),
    });
    assert.deepEqual(
      await listAttachments({ token: 'tok', tableName: 'C_Invoice', recordId: 'X' }),
      [],
    );
  });

  it('returns [] on fetch throw (network)', async () => {
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.deepEqual(
      await listAttachments({ token: 'tok', tableName: 'C_Invoice', recordId: 'X' }),
      [],
    );
  });
});

describe('fetchAttachmentBlobUrl', () => {
  let originalFetch;
  let originalURL;
  let originalBlob;
  let lastUrl;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalURL = globalThis.URL;
    originalBlob = globalThis.Blob;
    globalThis.URL = {
      createObjectURL: (blob) => `blob:fake/${blob.type || 'unknown'}`,
      revokeObjectURL: () => {},
    };
    globalThis.Blob = class FakeBlob {
      constructor(parts, opts) { this.parts = parts; this.type = opts?.type; }
    };
    lastUrl = null;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.URL = originalURL;
    globalThis.Blob = originalBlob;
  });

  it('returns null when required params are missing', async () => {
    assert.equal(await fetchAttachmentBlobUrl({}), null);
    assert.equal(await fetchAttachmentBlobUrl({ token: 'tok' }), null);
    assert.equal(await fetchAttachmentBlobUrl({ attachmentId: 'A1' }), null);
  });

  it('GETs /sws/neo/attachments/file/{id} and creates a blob URL', async () => {
    globalThis.fetch = async (url) => {
      lastUrl = String(url);
      return {
        ok: true,
        blob: async () => new globalThis.Blob(['x'], { type: 'application/pdf' }),
      };
    };
    const url = await fetchAttachmentBlobUrl({
      token: 'tok',
      attachmentId: 'A1',
      apiBaseUrl: 'http://host/sws/neo/purchase-invoice',
    });
    assert.match(lastUrl, /\/sws\/neo\/attachments\/file\/A1$/);
    assert.equal(url, 'blob:fake/application/pdf');
  });

  it('returns null on non-2xx response', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    assert.equal(
      await fetchAttachmentBlobUrl({ token: 'tok', attachmentId: 'A1' }),
      null,
    );
  });

  it('returns null on fetch throw', async () => {
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(
      await fetchAttachmentBlobUrl({ token: 'tok', attachmentId: 'A1' }),
      null,
    );
  });
});
