import { useState, useEffect, useRef } from 'react';
import { useUI } from '@/i18n';
import { buildLocationAddressLines } from '@/lib/locationAddress.js';

// ---------------------------------------------------------------------------
// Handlebars helpers (CommonJS for jsreport context)
// ---------------------------------------------------------------------------
const HELPERS = `
function fmt(v) {
  if (v == null || v === '') return '0';
  var n = Number(v);
  if (isNaN(n)) return String(v);
  return new Intl.NumberFormat('es', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n);
}
function fmtDate(v) {
  if (!v) return '';
  var d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
}
function ifEq(a, b, opts) { return a === b ? opts.fn(this) : opts.inverse(this); }
`;

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --gray-50:#F8F8FA; --gray-100:#E8E8ED; --gray-400:#8A8AA3; --gray-500:#6C6C89; --gray-700:#3F3F50; --gray-900:#121217;
  --fg-1:var(--gray-900); --fg-2:var(--gray-700); --fg-3:var(--gray-500); --fg-4:var(--gray-400);
  --border-1:var(--gray-100);
  --radius-sm:8px; --radius-lg:12px;
  --font-sans:'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:var(--font-sans); font-size:13px; line-height:18px; color:var(--fg-2); background:#fff; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }

.doc { width:794px; padding:56px 56px 48px; background:#fff; color:var(--fg-1); display:flex; flex-direction:column; gap:24px; }

/* ── Header ─────────────────────────────────────── */
.doc-header { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; border-bottom:2px solid var(--border-1); }
.doc-header-left { display:flex; align-items:center; gap:16px; }
.doc-logo-img { width:160px; height:64px; object-fit:contain; object-position:left center; display:block; flex-shrink:0; }
.doc-header-company .company-name { font-weight:700; font-size:15px; line-height:20px; color:var(--fg-1); }
.doc-header-company .company-cif { font-size:11px; color:var(--fg-3); margin-top:3px; }
.doc-header-meta { text-align:right; }
.doc-header-meta .doc-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--fg-3); }
.doc-header-meta .doc-num { font-size:22px; font-weight:700; letter-spacing:-0.01em; color:var(--fg-1); line-height:28px; margin-top:2px; font-variant-numeric:tabular-nums; }

/* ── Parties ─────────────────────────────────────── */
.doc-parties { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.doc-party-card { border:1px solid var(--border-1); border-radius:var(--radius-lg); padding:16px 18px; }
.doc-party-card .eyebrow { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--fg-3); margin-bottom:8px; }
.doc-party-card .party-name { font-weight:600; font-size:14px; color:var(--fg-1); line-height:20px; }
.doc-party-card .party-line { font-size:12px; line-height:18px; color:var(--fg-2); margin-top:2px; }
.doc-party-card .party-line.muted { color:var(--fg-3); }

/* ── Movement band ───────────────────────────────── */
.doc-movement { display:grid; grid-template-columns:1fr 1fr 1fr; background:var(--gray-50); border-radius:var(--radius-lg); padding:14px 20px; gap:16px; }
.doc-movement-cell .cell-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--fg-3); margin-bottom:4px; }
.doc-movement-cell .cell-value { font-size:13px; font-weight:500; color:var(--fg-1); }

/* ── Table ───────────────────────────────────────── */
.doc-table { width:100%; border-collapse:collapse; font-size:13px; }
.doc-table thead tr { background:var(--gray-50); }
.doc-table thead th { text-align:left; font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--fg-3); padding:10px 12px; }
.doc-table thead th:first-child { border-radius:var(--radius-sm) 0 0 var(--radius-sm); }
.doc-table thead th:last-child { border-radius:0 var(--radius-sm) var(--radius-sm) 0; }
.doc-table thead th.num, .doc-table tbody td.num { text-align:right; font-variant-numeric:tabular-nums; }
.doc-table tbody td { padding:12px 12px; color:var(--fg-2); vertical-align:top; }
.doc-table tbody tr + tr td { border-top:1px solid var(--border-1); }
.doc-table tbody td.code { color:var(--fg-3); font-size:12px; font-variant-numeric:tabular-nums; }
.doc-table tbody td.desc { color:var(--fg-1); font-weight:500; }

/* ── Observations ────────────────────────────────── */
.doc-observ { border:1px solid var(--border-1); border-radius:var(--radius-lg); padding:14px 18px; }
.doc-observ .eyebrow { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--fg-3); margin-bottom:6px; }
.doc-observ .body { font-size:12px; line-height:18px; color:var(--fg-2); }

/* ── Signature ───────────────────────────────────── */
.doc-signature { border-top:1px solid var(--border-1); padding-top:24px; display:grid; grid-template-columns:1fr 1fr; gap:32px; }
.doc-sig-field .sig-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--fg-3); margin-bottom:72px; display:block; }
.doc-sig-field .sig-line { border-top:1px solid var(--gray-400); }

/* ── Footer ──────────────────────────────────────── */
.doc-footer { padding-top:20px; border-top:1px solid var(--border-1); display:flex; justify-content:space-between; font-size:10px; color:var(--fg-4); text-transform:uppercase; letter-spacing:0.08em; }

@page { size:A4 portrait; margin:0; }
`;

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------
const TEMPLATE = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><style>{{{css}}}</style></head>
<body>
<div class="doc">

  <div class="doc-header">
    <div class="doc-header-left">
      {{#if companyLogoDataUrl}}<img class="doc-logo-img" src="{{companyLogoDataUrl}}" alt="">{{/if}}
      <div class="doc-header-company">
        <div class="company-name">{{companyName}}</div>
        {{#if companyTaxId}}<div class="company-cif">{{labels.taxId}} {{companyTaxId}}</div>{{/if}}
      </div>
    </div>
    <div class="doc-header-meta">
      <div class="doc-label">{{labels.title}}</div>
      <div class="doc-num">{{documentNo}}</div>
    </div>
  </div>

  <div class="doc-parties">
    <div class="doc-party-card">
      <div class="eyebrow">{{labels.issuerSection}}</div>
      <div class="party-name">{{companyName}}</div>
      {{#if companyAddress1}}<div class="party-line">{{companyAddress1}}</div>{{/if}}
      {{#if companyAddress2}}<div class="party-line">{{companyAddress2}}</div>{{/if}}
      {{#if companyCityLine}}<div class="party-line">{{companyCityLine}}</div>{{/if}}
      {{#if companyTaxId}}<div class="party-line muted">{{labels.taxId}} {{companyTaxId}}</div>{{/if}}
    </div>
    <div class="doc-party-card">
      <div class="eyebrow">{{labels.deliverySection}}</div>
      <div class="party-name">{{customerName}}</div>
      {{#each customerAddressLines}}<div class="party-line">{{this}}</div>{{/each}}
    </div>
  </div>

  <div class="doc-movement">
    <div class="doc-movement-cell">
      <div class="cell-label">{{labels.date}}</div>
      <div class="cell-value">{{fmtDate movementDate}}</div>
    </div>
    <div class="doc-movement-cell">
      <div class="cell-label">{{labels.salesOrder}}</div>
      <div class="cell-value">{{#if salesOrderRef}}{{salesOrderRef}}{{else}}—{{/if}}</div>
    </div>
    <div class="doc-movement-cell">
      <div class="cell-label">{{labels.warehouse}}</div>
      <div class="cell-value">{{#if warehouse}}{{warehouse}}{{else}}—{{/if}}</div>
    </div>
  </div>

  <table class="doc-table">
    <thead>
      <tr>
        <th style="width:64px">{{labels.colCode}}</th>
        <th>{{labels.colDescription}}</th>
        <th class="num" style="width:110px">{{labels.colOrdered}}</th>
        <th class="num" style="width:120px">{{labels.colDelivered}}</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="code">{{this.productCode}}</td>
        <td class="desc">{{this.productName}}</td>
        <td class="num">{{fmt this.orderedQty}}</td>
        <td class="num">{{fmt this.deliveredQty}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="doc-signature">
    <div class="doc-sig-field">
      <span class="sig-label">{{labels.signatureReceiver}}</span>
      <div class="sig-line"></div>
    </div>
    <div class="doc-sig-field">
      <span class="sig-label">{{labels.signatureDate}}</span>
      <div class="sig-line"></div>
    </div>
  </div>

  {{#if notes}}
  <div class="doc-observ">
    <div class="eyebrow">{{labels.notes}}</div>
    <div class="body">{{notes}}</div>
  </div>
  {{/if}}

  <div class="doc-footer">
    <span>{{companyName}}</span>
    <span>{{labels.page}} 1</span>
  </div>

</div>
</body></html>`;

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------
async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  const d = await res.json();
  return d?.response?.data?.[0] ?? d?.response?.data ?? d;
}

async function fetchAll(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const d = await res.json();
  return d?.response?.data ?? (Array.isArray(d) ? d : []);
}

async function fetchOptionalJson(url, token) {
  try { return await fetchJson(url, token); } catch { return null; }
}

async function fetchLocationAddress(locationId, base, token) {
  if (!locationId) return null;
  try {
    return await fetchJson(`${base}/contacts/locationAddress/${locationId}`, token);
  } catch { return null; }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read company logo'));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageDataUrl(imageId, base, token) {
  if (!imageId) return null;
  try {
    const res = await fetch(`${base}/image/${imageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Build shipment data for the template
// ---------------------------------------------------------------------------
async function buildShipmentData(shipmentId, base, token) {
  const [header, linesRaw, session] = await Promise.all([
    fetchJson(`${base}/goods-shipment/goodsShipment/${shipmentId}`, token),
    fetchAll(`${base}/goods-shipment/goodsShipmentLine?parentId=${shipmentId}&_startRow=0&_endRow=200`, token),
    fetchOptionalJson(`${base}/session`, token),
  ]);
  const [companyLogoDataUrl, partnerLocation] = await Promise.all([
    fetchImageDataUrl(session?.yourCompanyDocumentImageId, base, token),
    fetchLocationAddress(header.partnerAddress, base, token),
  ]);

  const linesSorted = [...linesRaw].sort(
    (a, b) => (Number(a.lineNo) || 0) - (Number(b.lineNo) || 0),
  );
  const lines = linesSorted.map((l, idx) => ({
    lineNo: idx + 1,
    productCode: l.productCode || l['product$_value'] || String(idx + 1),
    productName: l['product$_identifier'] || l.description || '—',
    orderedQty: l.orderLineQty ?? l.orderQuantity ?? 0,
    deliveredQty: l.movementQuantity ?? 0,
  }));

  const org = header.issuerOrg ?? {};
  const customerAddressLines = buildLocationAddressLines(
    partnerLocation,
    header['partnerAddress$_identifier'] || null,
  );

  const statusClassMap = { CO: 'status-co', DR: 'status-dr' };

  return {
    companyName: org.name || header['organization$_identifier'] || 'Empresa',
    companyAddress1: org.address1 || null,
    companyAddress2: org.address2 || null,
    companyCityLine: org.cityLine || null,
    companyTaxId: org.taxId || null,
    companyLogoDataUrl,
    documentNo: header.documentNo || '',
    documentStatusLabel: header['documentStatus$_identifier'] || header.documentStatus || '',
    documentStatusClass: statusClassMap[header.documentStatus] || 'status-default',
    movementDate: header.movementDate || '',
    customerName: header['businessPartner$_identifier'] || '—',
    customerAddressLines,
    warehouse: header['warehouse$_identifier'] || null,
    salesOrderRef: header['salesOrder$_identifier']?.split(' ')[0] || null,
    notes: header.description || null,
    lines,
  };
}

// ---------------------------------------------------------------------------
// Render via jsreport
// ---------------------------------------------------------------------------
async function renderShipmentPdf(data) {
  const payload = {
    template: {
      content: TEMPLATE,
      engine: 'handlebars',
      recipe: 'chrome-pdf',
      helpers: HELPERS,
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
    data: { css: CSS, ...data },
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
// Hook
// ---------------------------------------------------------------------------
/**
 * useShipmentPdf — fetches goods shipment data and renders a delivery note PDF
 * via jsreport. No prices are included in the document.
 *
 * @param {string|null} shipmentId — the shipment record ID
 * @param {string}      apiBaseUrl — e.g. "/sws/neo/goods-shipment"
 * @param {string}      token      — Bearer token
 * @returns {{ pdfUrl, pdfBlob, loading, error }}
 */
export function useShipmentPdf(shipmentId, apiBaseUrl, token) {
  const ui = useUI();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevUrlRef = useRef(null);

  useEffect(() => {
    if (!shipmentId || !apiBaseUrl || !token) return;

    const labels = {
      title:             ui('shipmentPdfTitle'),
      documentNo:        ui('shipmentPdfDocumentNo'),
      taxId:             ui('invoicePdfTaxId'),
      page:              ui('invoicePdfPage'),
      issuerSection:     ui('shipmentPdfIssuerSection'),
      deliverySection:   ui('shipmentPdfDeliverySection'),
      salesOrder:        ui('shipmentPdfSalesOrder'),
      date:              ui('shipmentPdfDate'),
      warehouse:         ui('shipmentPdfWarehouse'),
      colCode:           ui('invoicePdfColCode'),
      colDescription:    ui('invoicePdfColDescription'),
      colOrdered:        ui('shipmentPdfColOrdered'),
      colDelivered:      ui('shipmentPdfColDelivered'),
      notes:             ui('invoicePdfNotes'),
      signatureReceiver: ui('shipmentPdfSignatureReceiver'),
      signatureDate:     ui('shipmentPdfSignatureDate'),
    };

    const base = apiBaseUrl.replace(/\/[^/]+$/, '');

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    setPdfBlob(null);

    (async () => {
      try {
        const data = await buildShipmentData(shipmentId, base, token);
        const blob = await renderShipmentPdf({ ...data, labels });
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
  }, [shipmentId, apiBaseUrl, token]);

  return { pdfUrl, pdfBlob, loading, error };
}
