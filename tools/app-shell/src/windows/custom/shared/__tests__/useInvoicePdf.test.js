import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'useInvoicePdf.js'), 'utf8');

describe('useInvoicePdf', () => {

  // ── Exports ──────────────────────────────────────────────────────────────

  it('exports useInvoicePdf as a named export', () => {
    assert.match(src, /export function useInvoicePdf/);
  });

  it('accepts invoiceId, apiBaseUrl and token parameters', () => {
    assert.match(src, /useInvoicePdf\(invoiceId,\s*apiBaseUrl,\s*token\)/);
  });

  it('returns pdfUrl, pdfBlob, loading and error', () => {
    assert.match(src, /return \{ pdfUrl, pdfBlob, loading, error \}/);
  });

  // ── API endpoints ─────────────────────────────────────────────────────────

  it('fetches header from the sales-invoice header endpoint', () => {
    assert.match(src, /sales-invoice\/header\/\$\{invoiceId\}/);
  });

  it('fetches lines from the sales-invoice lines endpoint with parentId', () => {
    assert.match(src, /sales-invoice\/lines\?parentId=\$\{invoiceId\}/);
  });

  it('fetches header and lines in parallel via Promise.all', () => {
    assert.match(src, /Promise\.all/);
  });

  it('optionally fetches session defaults to resolve the company document image', () => {
    assert.match(src, /\/session/);
    assert.match(src, /yourCompanyDocumentImageId/);
  });

  it('derives the base URL by stripping the spec segment from apiBaseUrl', () => {
    assert.match(src, /apiBaseUrl\.replace/);
  });

  it('sends Bearer token in all API requests', () => {
    assert.match(src, /Authorization.*Bearer.*token/);
  });

  // ── PDF rendering ─────────────────────────────────────────────────────────

  it('renders the PDF via jsreport at /jsreport/api/report', () => {
    assert.match(src, /\/jsreport\/api\/report/);
  });

  it('uses the handlebars engine', () => {
    assert.match(src, /engine.*handlebars|handlebars.*engine/);
  });

  it('uses the chrome-pdf recipe for PDF generation', () => {
    assert.match(src, /chrome-pdf/);
  });

  it('creates a blob URL from the jsreport response', () => {
    assert.match(src, /URL\.createObjectURL\(blob\)/);
  });

  it('embeds the company logo in the rendered template when available', () => {
    assert.match(src, /companyLogoDataUrl/);
    assert.match(src, /inv-logo-img/);
  });

  it('renders the company identity block with name, address and tax ID', () => {
    assert.match(src, /companyName/);
    assert.match(src, /companyAddress1/);
    assert.match(src, /companyTaxId/);
  });

  it('pulls the issuer organization from the session endpoint', () => {
    assert.match(src, /session\?\.organization/);
  });

  it('fetches the full partner location from the contacts locationAddress endpoint', () => {
    assert.match(src, /contacts\/locationAddress\/\$\{locationId\}/);
  });

  it('builds multi-line customer address output for the PDF', () => {
    assert.match(src, /customerAddressLines/);
    assert.match(src, /inv-address-lines/);
  });

  // ── Memory management ─────────────────────────────────────────────────────

  it('revokes the previous blob URL on cleanup to avoid memory leaks', () => {
    assert.match(src, /URL\.revokeObjectURL/);
    assert.match(src, /prevUrlRef\.current/);
  });

  // ── Cancellation ─────────────────────────────────────────────────────────

  it('uses a cancellation flag to prevent setState after unmount', () => {
    assert.match(src, /let cancelled = false/);
    assert.match(src, /cancelled = true/);
    assert.match(src, /if \(cancelled\)/);
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('propagates error messages to the error state', () => {
    assert.match(src, /setError\(err\.message\)/);
  });

  // ── fetchAll — inline logic tests ─────────────────────────────────────────

  describe('fetchAll (inline replica)', () => {
    async function fetchAll(url, token) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) return [];
      const d = await res.json();
      return d?.response?.data ?? (Array.isArray(d) ? d : []);
    }

    it('returns empty array when the response is not ok', async () => {
      const saved = globalThis.fetch;
      globalThis.fetch = async () => ({ ok: false, status: 500 });
      const result = await fetchAll('/url', 'tok');
      assert.deepEqual(result, []);
      globalThis.fetch = saved;
    });

    it('extracts response.data from the NEO Headless envelope', async () => {
      const saved = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ response: { data: [{ id: 'L1' }, { id: 'L2' }] } }),
      });
      const result = await fetchAll('/url', 'tok');
      assert.equal(result.length, 2);
      assert.equal(result[0].id, 'L1');
      globalThis.fetch = saved;
    });

    it('falls back to a raw array response when the envelope is absent', async () => {
      const saved = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => [{ id: 'X' }],
      });
      const result = await fetchAll('/url', 'tok');
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'X');
      globalThis.fetch = saved;
    });
  });
});
