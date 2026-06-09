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

const HELPERS = `
function fmt(v) {
  if (v == null || v === '') return '0';
  var n = Number(v);
  if (isNaN(n)) return String(v);
  return new Intl.NumberFormat('es', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n);
}
` + COMMON_HANDLEBARS_HELPERS;


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
      <div class="eyebrow">{{labels.vendorSection}}</div>
      <div class="party-name">{{vendorName}}</div>
      {{#each vendorAddressLines}}<div class="party-line">{{this}}</div>{{/each}}
    </div>
  </div>

  <div class="doc-movement">
    <div class="doc-movement-cell">
      <div class="cell-label">{{labels.date}}</div>
      <div class="cell-value">{{fmtDate movementDate}}</div>
    </div>
    <div class="doc-movement-cell">
      <div class="cell-label">{{labels.sourceReceipt}}</div>
      <div class="cell-value">{{#if sourceReceiptRef}}{{sourceReceiptRef}}{{else}}—{{/if}}</div>
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
        <th class="num" style="width:130px">{{labels.colReturned}}</th>
        <th class="num" style="width:130px">{{labels.colOriginalQty}}</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="code">{{this.productCode}}</td>
        <td class="desc">{{this.productName}}</td>
        <td class="num">{{fmt this.returnedQty}}</td>
        <td class="num">{{fmt this.originalQty}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="doc-signature">
    <div class="doc-sig-field">
      <span class="sig-label">{{labels.signatureIssuer}}</span>
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

async function buildReturnToVendorData(shipmentId, base, token) {
  const [header, linesRaw, session] = await Promise.all([
    fetchJson(`${base}/return-to-vendor-shipment/returnToVendorShipment/${shipmentId}`, token),
    fetchAll(`${base}/return-to-vendor-shipment/returnToVendorShipmentLine?parentId=${shipmentId}&_startRow=0&_endRow=200`, token),
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
    returnedQty: l.movementQuantity ?? 0,
    originalQty: l.orderQuantity ?? 0,
  }));

  const org = header.issuerOrg ?? {};
  const vendorAddressLines = buildLocationAddressLines(
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
    movementDate: header.movementDate || '',
    vendorName: header['businessPartner$_identifier'] || '—',
    vendorAddressLines,
    warehouse: header['warehouse$_identifier'] || null,
    sourceReceiptRef: header.sourceReceiptDocNo || null,
    notes: header.description || null,
    lines,
  };
}

export function useReturnToVendorPdf(shipmentId, apiBaseUrl, token) {
  const ui = useUI();
  return usePdfGenerator(shipmentId, apiBaseUrl, token, (id, base, tok) => {
    const labels = getReturnToVendorPdfLabels(ui);
    return buildReturnToVendorData(id, base, tok).then((data) => renderPdf(TEMPLATE, COMMON_PDF_CSS, HELPERS, { ...data, labels }));
  });
}

export async function generateReturnToVendorPdf(shipmentId, apiBaseUrl, token, labels) {
  const base = apiBaseUrl.replace(/\/[^/]+$/, '');
  const data = await buildReturnToVendorData(shipmentId, base, token);
  return renderPdf(TEMPLATE, COMMON_PDF_CSS, HELPERS, { ...data, labels });
}

export function getReturnToVendorPdfLabels(ui) {
  return {
    title:            ui('returnToVendorPdfTitle'),
    taxId:            ui('invoicePdfTaxId'),
    page:             ui('invoicePdfPage'),
    issuerSection:    ui('shipmentPdfIssuerSection'),
    vendorSection:    ui('returnToVendorPdfVendorSection'),
    sourceReceipt:    ui('returnToVendorPdfSourceReceipt'),
    date:             ui('shipmentPdfDate'),
    warehouse:        ui('shipmentPdfWarehouse'),
    colCode:          ui('invoicePdfColCode'),
    colDescription:   ui('invoicePdfColDescription'),
    colReturned:      ui('returnToVendorPdfColReturned'),
    colOriginalQty:   ui('returnToVendorPdfColOriginalQty'),
    notes:            ui('invoicePdfNotes'),
    signatureIssuer:  ui('returnToVendorPdfSignatureIssuer'),
    signatureDate:    ui('shipmentPdfSignatureDate'),
  };
}
