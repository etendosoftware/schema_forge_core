import { useUI } from '@/i18n';
import {
  COMMON_HANDLEBARS_HELPERS,
  COMMON_PDF_CSS,
  fetchJson,
  fetchAll,
  fetchOptionalJson,
  fetchLocationAddress,
  fetchImageDataUrl,
  buildLocationAddressLines,
  renderPdf,
  usePdfGenerator,
} from '../shared/pdfUtils.js';

// ---------------------------------------------------------------------------
// Handlebars helpers — fmt formats as 0–3 decimal places (quantities, no prices)
// ---------------------------------------------------------------------------
const HELPERS = `
function fmt(v) {
  if (v == null || v === '') return '0';
  var n = Number(v);
  if (isNaN(n)) return String(v);
  return new Intl.NumberFormat('es', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n);
}
` + COMMON_HANDLEBARS_HELPERS;


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

  return {
    companyName: org.name || header['organization$_identifier'] || 'Empresa',
    companyAddress1: org.address1 || null,
    companyAddress2: org.address2 || null,
    companyCityLine: org.cityLine || null,
    companyTaxId: org.taxId || null,
    companyLogoDataUrl,
    documentNo: header.documentNo || '',
    documentStatusLabel: header['documentStatus$_identifier'] || header.documentStatus || '',
    documentStatusClass: ({ CO: 'status-co', DR: 'status-dr' })[header.documentStatus] || 'status-default',
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
  return usePdfGenerator(shipmentId, apiBaseUrl, token, (id, base, tok) => {
    const labels = getShipmentPdfLabels(ui);
    return buildShipmentData(id, base, tok).then((data) =>
      renderPdf(TEMPLATE, COMMON_PDF_CSS, HELPERS, { ...data, labels }),
    );
  });
}

export function getShipmentPdfLabels(ui) {
  return {
    title:             ui('shipmentPdfTitle'),
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
}

export async function generateShipmentPdf(shipmentId, apiBaseUrl, token, labels) {
  const base = apiBaseUrl.replace(/\/[^/]+$/, '');
  const data = await buildShipmentData(shipmentId, base, token);
  return renderPdf(TEMPLATE, COMMON_PDF_CSS, HELPERS, { ...data, labels });
}
