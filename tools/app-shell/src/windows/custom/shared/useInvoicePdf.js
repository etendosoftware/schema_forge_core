import { useState, useEffect, useRef } from 'react';
import { useUI } from '@/i18n';

// ---------------------------------------------------------------------------
// Handlebars helpers (CommonJS for jsreport context)
// ---------------------------------------------------------------------------
const HELPERS = `
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
const CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; }
.page { padding: 12mm 15mm; max-width: 210mm; }

/* Header */
.header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6mm; }
.company-info h1 { font-size:13pt; font-weight:700; color:#1a2e5a; margin-bottom:1mm; }
.company-info p { font-size:8pt; color:#555; line-height:1.5; }
.invoice-box { background:#1a2e5a; color:#fff; border-radius:4px; padding:6mm 8mm; text-align:center; min-width:45mm; }
.invoice-box .label { font-size:9pt; letter-spacing:1px; opacity:0.85; }
.invoice-box .number { font-size:20pt; font-weight:700; margin-top:1mm; letter-spacing:1px; }

/* Info row */
.info-row { display:flex; gap:6mm; margin-bottom:5mm; }
.info-block { flex:1; border:1px solid #d0d0d0; border-radius:3px; padding:3mm 4mm; }
.info-block .section-title { font-size:7pt; font-weight:700; color:#1a2e5a; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2mm; border-bottom:1px solid #e0e0e0; padding-bottom:1mm; }
.info-block p { font-size:8pt; line-height:1.6; color:#333; }
.info-block span.label { color:#666; font-size:7.5pt; }

/* Lines table */
.lines-table { width:100%; border-collapse:collapse; margin-bottom:5mm; }
.lines-table thead tr { background:#1a2e5a; color:#fff; }
.lines-table thead th { padding:2.5mm 3mm; text-align:left; font-size:8pt; font-weight:600; letter-spacing:0.3px; }
.lines-table thead th.right { text-align:right; }
.lines-table tbody tr:nth-child(even) { background:#f4f7fc; }
.lines-table tbody td { padding:2mm 3mm; font-size:8.5pt; border-bottom:1px solid #e8e8e8; vertical-align:top; }
.lines-table tbody td.right { text-align:right; }
.lines-table tbody td.center { text-align:center; }
.lines-table .empty-row td { height:8mm; }

/* Totals */
.bottom-section { display:flex; gap:6mm; margin-top:2mm; }
.notes-block { flex:1; }
.notes-block .section-title { font-size:7pt; font-weight:700; color:#1a2e5a; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2mm; }
.notes-block p { font-size:8pt; color:#555; border:1px solid #e0e0e0; border-radius:3px; padding:3mm; min-height:18mm; }
.totals-block { width:68mm; }
.totals-table { width:100%; border-collapse:collapse; }
.totals-table td { padding:1.5mm 3mm; font-size:8.5pt; }
.totals-table td.label-col { color:#555; }
.totals-table td.amount-col { text-align:right; font-family:'Courier New', monospace; }
.totals-table tr.total-row { background:#1a2e5a; color:#fff; font-weight:700; font-size:9.5pt; }
.totals-table tr.subtotal-row td { border-top:1px solid #d0d0d0; }

@page { size:A4 portrait; margin:0; }
@media print { .page { padding:12mm 15mm; } }
`;

// ---------------------------------------------------------------------------
// Handlebars template
// ---------------------------------------------------------------------------
const TEMPLATE = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>{{{css}}}</style></head>
<body><div class="page">

  <!-- Header -->
  <div class="header">
    <div class="company-info">
      <h1>{{orgName}}</h1>
      <p>{{#if orgAddress}}{{orgAddress}}<br>{{/if}}{{#if orgPhone}}Tel: {{orgPhone}}{{/if}}</p>
    </div>
    <div class="invoice-box">
      <div class="label">{{labels.title}}</div>
      <div class="number">{{documentNo}}</div>
    </div>
  </div>

  <!-- Info row -->
  <div class="info-row">
    <!-- Customer info -->
    <div class="info-block" style="flex:1.3">
      <div class="section-title">{{labels.customerSection}}</div>
      <p><span class="label">{{labels.customer}} </span>{{customerName}}</p>
      {{#if customerAddress}}<p><span class="label">{{labels.address}} </span>{{customerAddress}}</p>{{/if}}
    </div>
    <!-- Invoice details -->
    <div class="info-block" style="flex:1">
      <div class="section-title">{{labels.invoiceSection}}</div>
      <p><span class="label">{{labels.date}} </span>{{fmtDate invoiceDate}}</p>
      {{#if paymentTerms}}<p><span class="label">{{labels.paymentTerms}} </span>{{paymentTerms}}</p>{{/if}}
      {{#if paymentMethod}}<p><span class="label">{{labels.paymentMethod}} </span>{{paymentMethod}}</p>{{/if}}
    </div>
  </div>

  <!-- Lines table -->
  <table class="lines-table">
    <thead>
      <tr>
        <th style="width:8%">{{labels.colCode}}</th>
        <th style="width:38%">{{labels.colDescription}}</th>
        <th class="right" style="width:9%">{{labels.colQty}}</th>
        <th class="right" style="width:13%">{{labels.colUnitPrice}}</th>
        <th class="right" style="width:8%">{{labels.colDiscount}}</th>
        <th class="right" style="width:10%">{{labels.colTax}}</th>
        <th class="right" style="width:14%">{{labels.colTotal}}</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td>{{this.lineNo}}</td>
        <td>{{this.productName}}</td>
        <td class="right">{{fmt this.quantity}}</td>
        <td class="right">{{fmt this.unitPrice}}</td>
        <td class="center">{{#if this.discount}}{{this.discount}}%{{else}}—{{/if}}</td>
        <td class="center">{{this.taxName}}</td>
        <td class="right">{{fmt this.lineTotal}}</td>
      </tr>
      {{/each}}
      {{#each emptyRows}}<tr class="empty-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>{{/each}}
    </tbody>
  </table>

  <!-- Bottom: notes + totals -->
  <div class="bottom-section">
    <div class="notes-block">
      <div class="section-title">{{labels.notes}}</div>
      <p>{{#if notes}}{{notes}}{{/if}}</p>
    </div>
    <div class="totals-block">
      <table class="totals-table">
        <tr class="subtotal-row">
          <td class="label-col">{{labels.subtotal}}</td>
          <td class="amount-col">{{fmt netAmount}}</td>
        </tr>
        <tr>
          <td class="label-col">{{labels.tax}}</td>
          <td class="amount-col">{{fmt taxAmount}}</td>
        </tr>
        <tr class="total-row">
          <td>{{labels.grandTotal}}</td>
          <td class="amount-col">{{fmt grandTotal}}</td>
        </tr>
      </table>
    </div>
  </div>

</div></body></html>`;

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

// ---------------------------------------------------------------------------
// Build invoice data for the template
// ---------------------------------------------------------------------------
async function buildInvoiceData(invoiceId, base, token) {
  // Fetch header and lines in parallel
  const [header, linesRaw] = await Promise.all([
    fetchJson(`${base}/sales-invoice/header/${invoiceId}`, token),
    fetchAll(`${base}/sales-invoice/lines?parentId=${invoiceId}`, token),
  ]);

  const lines = linesRaw.map((l, idx) => ({
    lineNo: l.lineNo || (idx + 1),
    productName: l.product$_identifier || l.description || '—',
    quantity: l.invoicedQuantity ?? l.qtyInvoiced ?? 0,
    unitPrice: l.unitPrice ?? l.priceActual ?? 0,
    discount: l.discount ? Number(l.discount) : null,
    taxName: l.tax$_identifier || l.taxRate || '',
    lineTotal: l.lineNetAmount ?? l.lineAmount ?? 0,
  }));

  // Pad to at least 8 rows for a clean look
  const MIN_ROWS = 8;
  const emptyRows = lines.length < MIN_ROWS
    ? Array(MIN_ROWS - lines.length).fill(null)
    : [];

  const grandTotal = Number(header.grandTotalAmount ?? 0);
  const netAmount  = Number(header.summedLineAmount ?? header.totalLines ?? 0);
  const taxAmount  = grandTotal - netAmount;

  return {
    // Org info — use what's available in the header
    orgName: header.organization$_identifier || header.organization || 'Empresa',
    orgAddress: null,
    orgPhone: null,
    // Invoice
    documentNo: header.documentNo || '',
    invoiceDate: header.invoiceDate || header.dateInvoiced || '',
    // Customer
    customerName: header.businessPartner$_identifier || header.businessPartner || '—',
    customerAddress: header.partnerAddress$_identifier || header.bpAddress || null,
    // Payment
    paymentMethod: header.paymentMethod$_identifier || null,
    paymentTerms: header.paymentTerms$_identifier || null,
    // Notes
    notes: header.description || null,
    // Lines
    lines,
    emptyRows,
    // Totals
    netAmount,
    taxAmount,
    grandTotal,
  };
}

// ---------------------------------------------------------------------------
// Render via jsreport
// ---------------------------------------------------------------------------
async function renderInvoicePdf(data) {
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
 * useInvoicePdf — fetches sales invoice data and renders it as a PDF via jsreport.
 *
 * @param {string|null} invoiceId  — the invoice record ID
 * @param {string}      apiBaseUrl — e.g. "https://host/sws/neo/sales-invoice"
 * @param {string}      token      — Bearer token
 * @returns {{ pdfUrl: string|null, loading: boolean, error: string|null }}
 */
export function useInvoicePdf(invoiceId, apiBaseUrl, token) {
  const ui = useUI();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevUrlRef = useRef(null);

  useEffect(() => {
    if (!invoiceId || !apiBaseUrl || !token) return;

    // Build labels from i18n for the current locale
    const labels = {
      title:           ui('invoicePdfTitle'),
      customerSection: ui('invoicePdfCustomerSection'),
      invoiceSection:  ui('invoicePdfInvoiceSection'),
      customer:        ui('invoicePdfCustomer'),
      address:         ui('invoicePdfAddress'),
      date:            ui('invoicePdfDate'),
      paymentTerms:    ui('invoicePdfPaymentTerms'),
      paymentMethod:   ui('invoicePdfPaymentMethod'),
      colCode:         ui('invoicePdfColCode'),
      colDescription:  ui('invoicePdfColDescription'),
      colQty:          ui('invoicePdfColQty'),
      colUnitPrice:    ui('invoicePdfColUnitPrice'),
      colDiscount:     ui('invoicePdfColDiscount'),
      colTax:          ui('invoicePdfColTax'),
      colTotal:        ui('invoicePdfColTotal'),
      subtotal:        ui('invoicePdfSubtotal'),
      tax:             ui('invoicePdfTax'),
      grandTotal:      ui('invoicePdfGrandTotal'),
      notes:           ui('invoicePdfNotes'),
    };

    // Compute base URL (strip spec name: .../sws/neo/sales-invoice → .../sws/neo)
    const base = apiBaseUrl.replace(/\/[^/]+$/, '');

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfUrl(null);

    (async () => {
      try {
        const data = await buildInvoiceData(invoiceId, base, token);
        const blob = await renderInvoicePdf({ ...data, labels });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        prevUrlRef.current = url;
        setPdfUrl(url);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // Revoke previous blob URL to free memory
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
    };
  }, [invoiceId, apiBaseUrl, token]);

  return { pdfUrl, loading, error };
}
