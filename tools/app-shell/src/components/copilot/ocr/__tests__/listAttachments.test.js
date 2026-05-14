import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  listAttachments,
  parseListAttachmentsEnvelope,
  base64ToBlobUrl,
} from '../listAttachments.js';

/* -------------------------------------------------------------------------- */
/* parseListAttachmentsEnvelope                                                */
/* -------------------------------------------------------------------------- */

describe('parseListAttachmentsEnvelope', () => {
  it('returns [] for missing/non-string envelopes', () => {
    assert.deepEqual(parseListAttachmentsEnvelope(null), []);
    assert.deepEqual(parseListAttachmentsEnvelope({}), []);
    assert.deepEqual(parseListAttachmentsEnvelope({ message: null }), []);
    assert.deepEqual(parseListAttachmentsEnvelope({ message: 42 }), []);
  });

  it('returns [] when the message is not valid JSON', () => {
    assert.deepEqual(parseListAttachmentsEnvelope({ message: '{not json' }), []);
  });

  it('parses an attachments array from the envelope', () => {
    const envelope = {
      message: JSON.stringify({
        attachments: [
          { id: 'A1', name: 'invoice.pdf', base64: 'JVBERi0=' },
          { id: 'A2', name: 'extra.pdf', base64: 'X' },
        ],
      }),
    };
    const result = parseListAttachmentsEnvelope(envelope);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'A1');
    assert.equal(result[1].name, 'extra.pdf');
  });

  it('drops malformed rows (missing id)', () => {
    const envelope = {
      message: JSON.stringify({ attachments: [{ id: 'A1' }, { name: 'noid.pdf' }, null] }),
    };
    const result = parseListAttachmentsEnvelope(envelope);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'A1');
  });

  it('returns [] when attachments is missing or not an array', () => {
    assert.deepEqual(
      parseListAttachmentsEnvelope({ message: JSON.stringify({}) }),
      [],
    );
    assert.deepEqual(
      parseListAttachmentsEnvelope({ message: JSON.stringify({ attachments: 'oops' }) }),
      [],
    );
  });
});

/* -------------------------------------------------------------------------- */
/* base64ToBlobUrl                                                            */
/* -------------------------------------------------------------------------- */

describe('base64ToBlobUrl', () => {
  let originalAtob;
  let originalBlob;
  let originalURL;
  beforeEach(() => {
    originalAtob = globalThis.atob;
    originalBlob = globalThis.Blob;
    originalURL = globalThis.URL;
    globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
    globalThis.Blob = class FakeBlob {
      constructor(parts, opts) { this.parts = parts; this.type = opts?.type; }
    };
    globalThis.URL = {
      createObjectURL: (blob) => `blob:fake/${blob.type}`,
      revokeObjectURL: () => {},
    };
  });
  afterEach(() => {
    globalThis.atob = originalAtob;
    globalThis.Blob = originalBlob;
    globalThis.URL = originalURL;
  });

  it('returns null for empty input', () => {
    assert.equal(base64ToBlobUrl(null), null);
    assert.equal(base64ToBlobUrl(''), null);
  });

  it('produces a Blob URL with the requested mime type', () => {
    // 'JVBERi0=' is base64 for '%PDF-' which is the standard PDF magic.
    const url = base64ToBlobUrl('JVBERi0=', 'application/pdf');
    assert.equal(url, 'blob:fake/application/pdf');
  });

  it('defaults the mime type to application/pdf', () => {
    const url = base64ToBlobUrl('JVBERi0=');
    assert.equal(url, 'blob:fake/application/pdf');
  });
});

/* -------------------------------------------------------------------------- */
/* listAttachments                                                            */
/* -------------------------------------------------------------------------- */

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
    assert.deepEqual(await listAttachments({ token: 'tok', tabId: '290' }), []);
    assert.deepEqual(await listAttachments({ token: 'tok', recordId: 'X' }), []);
  });

  it('GETs /webhooks/?name=ListAttachments with the params', async () => {
    globalThis.fetch = async (url) => {
      lastUrl = String(url);
      return {
        ok: true,
        json: async () => ({
          message: JSON.stringify({
            attachments: [{ id: 'A1', name: 'doc.pdf', base64: 'PDF' }],
          }),
        }),
      };
    };
    const result = await listAttachments({ token: 'tok', tabId: '290', recordId: 'INV-1' });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'A1');
    assert.match(lastUrl, /\/webhooks\/\?/);
    assert.match(lastUrl, /name=ListAttachments/);
    assert.match(lastUrl, /ADTabId=290/);
    assert.match(lastUrl, /RecordId=INV-1/);
  });

  it('returns [] on non-2xx response', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });
    assert.deepEqual(
      await listAttachments({ token: 'tok', tabId: '290', recordId: 'X' }),
      [],
    );
  });

  it('returns [] on fetch throw (network)', async () => {
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.deepEqual(
      await listAttachments({ token: 'tok', tabId: '290', recordId: 'X' }),
      [],
    );
  });
});
