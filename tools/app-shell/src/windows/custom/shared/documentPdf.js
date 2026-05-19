import { useState, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Handlebars helpers (CommonJS for jsreport context)
// ---------------------------------------------------------------------------
export const DOCUMENT_HELPERS = `
function fmt(v) {
  if (v == null || v === '') return '0.00';
  var n = Number(v);
  if (isNaN(n)) return String(v);
  return new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(v) {
  if (!v) return '';
  var d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
}
function ifEq(a, b, opts) { return a === b ? opts.fn(this) : opts.inverse(this); }
function add(a, b) { return (Number(a)||0) + (Number(b)||0); }
`;

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
export const DOCUMENT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --gray-100:#E8E8ED; --gray-400:#8A8AA3; --gray-500:#6C6C89; --gray-700:#3F3F50; --gray-900:#121217;
  --fg-1:var(--gray-900); --fg-2:var(--gray-700); --fg-3:var(--gray-500); --fg-4:var(--gray-400);
  --border-1:var(--gray-100);
  --radius-lg:12px;
  --font-sans:'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: var(--font-sans); font-size: 13px; line-height: 18px; color: var(--fg-2); background:#fff; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }

.invoice {
  width: 794px;
  min-height: 1123px;
  padding: 56px 56px 48px;
  background:#fff;
  color: var(--fg-1);
  display:flex;
  flex-direction:column;
  gap:24px;
}

/* Shared company atom */
.inv-company-name { font-weight:700; font-size:16px; line-height:22px; letter-spacing:-0.01em; color:var(--fg-1); }
.inv-company-lines { color:var(--fg-2); font-size:12px; line-height:18px; }
.inv-company-lines .muted { color:var(--fg-3); }

/* Logo */
.inv-logo-img { max-width:140px; max-height:56px; object-fit:contain; object-position:left center; flex-shrink:0; display:block; }

/* Eyebrow */
.eyebrow {
  font-size:10px;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:0.08em;
  color:var(--fg-3);
}

/* Header B — full-width bar */
.inv-header-b {
  display:grid;
  grid-template-columns:auto 1fr auto;
  gap:28px;
  align-items:center;
  padding:20px 24px;
  background:#fff;
  border:1px solid var(--border-1);
  border-radius:var(--radius-lg);
}
.inv-header-b.no-logo { grid-template-columns:1fr auto; }
.inv-header-b .meta { text-align:right; border-left:1px solid var(--border-1); padding-left:24px; }
.inv-header-b .meta .label { font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:var(--fg-3); font-weight:600; }
.inv-header-b .meta .doc-type { font-size:12px; color:var(--fg-2); margin-top:2px; }
.inv-header-b .meta .num { font-size:22px; font-weight:700; line-height:28px; letter-spacing:-0.01em; color:var(--fg-1); margin-top:2px; font-variant-numeric:tabular-nums; }

/* Info grid */
.inv-info-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.inv-info-card { border:1px solid var(--border-1); border-radius:var(--radius-lg); padding:16px 18px; background:#fff; }
.inv-info-card .eyebrow { margin-bottom:8px; }
.inv-info-card .row { font-size:13px; line-height:20px; color:var(--fg-2); }
.inv-info-card .row strong { color:var(--fg-1); font-weight:600; }
.inv-address-lines { margin-top:2px; display:flex; flex-direction:column; gap:2px; }

/* Lines table */
.inv-table { width:100%; border-collapse:collapse; font-size:13px; margin-top:4px; }
.inv-table thead th { text-align:left; font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--fg-3); padding:10px 8px; border-bottom:1px solid var(--border-1); }
.inv-table thead th.num, .inv-table tbody td.num { text-align:right; font-variant-numeric:tabular-nums; }
.inv-table tbody td { padding:14px 8px; color:var(--fg-2); vertical-align:top; }
.inv-table tbody tr + tr td { border-top:1px solid var(--border-1); }
.inv-table tbody td.code { color:var(--fg-3); font-variant-numeric:tabular-nums; }
.inv-table tbody td.desc { color:var(--fg-1); font-weight:500; }
.inv-table .iva-pill { display:inline-block; font-size:11px; color:var(--fg-2); white-space:nowrap; }

/* Totals */
.inv-totals { display:flex; justify-content:flex-end; padding-top:12px; border-top:1px solid var(--border-1); }
.inv-totals-inner { width:300px; display:flex; flex-direction:column; gap:8px; }
.inv-totals .row { display:flex; justify-content:space-between; font-size:13px; color:var(--fg-2); font-variant-numeric:tabular-nums; }
.inv-totals .row.grand { margin-top:8px; padding-top:10px; border-top:1px solid var(--border-1); font-size:15px; font-weight:700; color:var(--fg-1); }
.inv-totals .row.discount { color:var(--fg-3); font-size:12px; }

/* Observations */
.inv-observ { border:1px solid var(--border-1); border-radius:var(--radius-lg); padding:14px 18px; display:grid; grid-template-columns:120px 1fr; gap:16px; margin-top:8px; }
.inv-observ .eyebrow { padding-top:2px; }
.inv-observ .body { font-size:12px; line-height:18px; color:var(--fg-2); }

/* Footer */
.inv-footer { margin-top:auto; padding-top:24px; border-top:1px solid var(--border-1); display:flex; justify-content:space-between; font-size:10px; color:var(--fg-4); text-transform:uppercase; letter-spacing:0.08em; }

@page { size:A4 portrait; margin:0; }
`;

// ---------------------------------------------------------------------------
// Handlebars template
// labels.documentSection — set per-document-type by each hook's labels object
// labels.validUntil      — rendered only when data.validUntil is set (quotations only)
// ---------------------------------------------------------------------------
export const DOCUMENT_TEMPLATE = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><style>{{{css}}}</style></head>
<body>
<div class="invoice">

  <!-- Header B: logo | company data | document meta -->
  <div class="inv-header-b{{#unless companyLogoDataUrl}} no-logo{{/unless}}">
    {{#if companyLogoDataUrl}}
    <img class="inv-logo-img" src="{{companyLogoDataUrl}}" alt="{{companyName}}">
    {{/if}}
    <div class="inv-company-lines">
      <div class="inv-company-name">{{companyName}}</div>
      {{#if companyAddress1}}<div style="margin-top:6px">{{companyAddress1}}</div>{{/if}}
      {{#if companyAddress2}}<div>{{companyAddress2}}</div>{{/if}}
      {{#if companyCityLine}}<div>{{companyCityLine}}</div>{{/if}}
      {{#if companyTaxId}}<div class="muted">{{labels.taxId}} {{companyTaxId}}</div>{{/if}}
    </div>
    <div class="meta">
      <div class="label">{{labels.title}}</div>
      <div class="doc-type">{{labels.documentNo}}</div>
      <div class="num">{{documentNo}}</div>
    </div>
  </div>

  <!-- Info cards -->
  <div class="inv-info-grid">
    <div class="inv-info-card">
      <div class="eyebrow">{{labels.customerSection}}</div>
      <div class="row"><strong>{{labels.customer}}</strong> {{customerName}}</div>
      {{#if hasCustomerAddress}}
      <div class="row"><strong>{{labels.address}}</strong></div>
      <div class="inv-address-lines">
        {{#each customerAddressLines}}<div class="row">{{this}}</div>{{/each}}
      </div>
      {{/if}}
    </div>
    <div class="inv-info-card">
      <div class="eyebrow">{{labels.documentSection}}</div>
      <div class="row"><strong>{{labels.date}}</strong> {{fmtDate invoiceDate}}</div>
      {{#if paymentTerms}}<div class="row"><strong>{{labels.paymentTerms}}</strong> {{paymentTerms}}</div>{{/if}}
      {{#if paymentMethod}}<div class="row"><strong>{{labels.paymentMethod}}</strong> {{paymentMethod}}</div>{{/if}}
      {{#if validUntil}}<div class="row"><strong>{{labels.validUntil}}</strong> {{fmtDate validUntil}}</div>{{/if}}
    </div>
  </div>

  <!-- Lines table -->
  <table class="inv-table">
    <thead>
      <tr>
        <th style="width:56px">{{labels.colCode}}</th>
        <th>{{labels.colDescription}}</th>
        <th class="num" style="width:90px">{{labels.colQty}}</th>
        <th class="num" style="width:96px">{{labels.colUnitPrice}}</th>
        <th class="num" style="width:70px">{{labels.colDiscount}}</th>
        <th style="width:90px">{{labels.colTax}}</th>
        <th class="num" style="width:80px">{{labels.colTotal}}</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="code">{{this.lineNo}}</td>
        <td class="desc">{{this.productName}}</td>
        <td class="num">{{fmt this.quantity}}</td>
        <td class="num">{{fmt this.unitPrice}}</td>
        <td class="num">{{#if this.discount}}{{this.discount}}%{{else}}–{{/if}}</td>
        <td><span class="iva-pill">{{this.taxName}}</span></td>
        <td class="num">{{fmt this.lineTotal}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="inv-totals">
    <div class="inv-totals-inner">
      {{#if grossAmount}}
      <div class="row"><span>{{labels.subtotalWithoutDiscount}}</span><span>{{fmt grossAmount}}</span></div>
      <div class="row discount"><span>{{labels.discountPerProduct}}</span><span>−{{fmt discountPerProduct}}</span></div>
      {{/if}}
      {{#if totalDiscountAmt}}
      <div class="row discount"><span>{{labels.totalDiscount}} ({{etgoTotalDiscount}}%)</span><span>−{{fmt totalDiscountAmt}}</span></div>
      {{/if}}
      <div class="row"><span>{{labels.subtotal}}</span><span>{{fmt netAmount}}</span></div>
      <div class="row"><span>{{labels.tax}}</span><span>{{fmt taxAmount}}</span></div>
      <div class="row grand"><span>{{labels.grandTotal}}</span><span>{{fmt grandTotal}}</span></div>
    </div>
  </div>

  <!-- Observations -->
  <div class="inv-observ">
    <div class="eyebrow">{{labels.notes}}</div>
    <div class="body">{{notes}}</div>
  </div>

  <!-- Footer -->
  <div class="inv-footer">
    <span>{{companyName}}</span>
    <span>{{labels.page}} 1</span>
  </div>

</div>
</body></html>`;

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------
export async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  const d = await res.json();
  return d?.response?.data?.[0] ?? d?.response?.data ?? d;
}

export async function fetchAll(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const d = await res.json();
  return d?.response?.data ?? (Array.isArray(d) ? d : []);
}

export async function fetchOptionalJson(url, token) {
  try {
    return await fetchJson(url, token);
  } catch {
    return null;
  }
}

export async function fetchLocationAddress(locationId, base, token) {
  if (!locationId) return null;
  try {
    return await fetchJson(`${base}/contacts/locationAddress/${locationId}`, token);
  } catch {
    return null;
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read company logo'));
    reader.readAsDataURL(blob);
  });
}

export async function fetchImageDataUrl(imageId, base, token) {
  if (!imageId) return null;
  try {
    const res = await fetch(`${base}/image/${imageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Render via jsreport
// ---------------------------------------------------------------------------
export async function renderDocumentPdf(data) {
  const payload = {
    template: {
      content: DOCUMENT_TEMPLATE,
      engine: 'handlebars',
      recipe: 'chrome-pdf',
      helpers: DOCUMENT_HELPERS,
      chrome: {
        format: 'A4',
        landscape: false,
        marginTop: '0mm',
        marginBottom: '0mm',
        marginLeft: '0mm',
        marginRight: '0mm',
        printBackground: true,
      },
    },
    data: { css: DOCUMENT_CSS, ...data },
  };

  const res = await fetch('/jsreport/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`jsreport ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.blob();
}

// ---------------------------------------------------------------------------
// Generic PDF hook — shared by all document-type hooks
// labels are kept in a ref so they never re-trigger the effect on locale change
// ---------------------------------------------------------------------------
export function useDocumentPdf(recordId, apiBaseUrl, token, buildDataFn, labels) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevUrlRef = useRef(null);
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  useEffect(() => {
    if (!recordId || !apiBaseUrl || !token) return;
    const base = apiBaseUrl.replace(/\/[^/]+$/, '');
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    setPdfBlob(null);

    (async () => {
      try {
        const data = await buildDataFn(recordId, base, token);
        const blob = await renderDocumentPdf({ ...data, labels: labelsRef.current });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        prevUrlRef.current = url;
        setPdfUrl(url);
        setPdfBlob(blob);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setPdfBlob(null);
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
    };
  }, [recordId, apiBaseUrl, token, buildDataFn]);

  return { pdfUrl, pdfBlob, loading, error };
}

