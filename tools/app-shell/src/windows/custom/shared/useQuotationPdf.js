import { useUI } from '@/i18n';
import { buildLocationAddressLines } from '@/lib/locationAddress.js';
import {
  fetchJson,
  fetchAll,
  fetchOptionalJson,
  fetchLocationAddress,
  fetchImageDataUrl,
  useDocumentPdf,
} from './documentPdf.js';

// ---------------------------------------------------------------------------
// Build quotation data for the template
// ---------------------------------------------------------------------------
async function buildQuotationData(quotationId, base, token) {
  const [header, linesRaw, session] = await Promise.all([
    fetchJson(`${base}/sales-quotation/quotation/${quotationId}`, token),
    fetchAll(`${base}/sales-quotation/quotationLine?parentId=${quotationId}`, token),
    fetchOptionalJson(`${base}/session`, token),
  ]);
  const [companyLogoDataUrl, partnerLocation] = await Promise.all([
    fetchImageDataUrl(session?.yourCompanyDocumentImageId, base, token),
    fetchLocationAddress(header.partnerAddress, base, token),
  ]);

  const linesSorted = [...linesRaw].sort(
    (a, b) => (Number(a.lineNo) || 0) - (Number(b.lineNo) || 0)
  );
  const lines = linesSorted.map((l, idx) => ({
    lineNo: l.lineNo || (idx + 1),
    productName: l.product$_identifier || l.description || '—',
    quantity: l.orderedQuantity ?? 0,
    unitPrice: l.unitPrice ?? 0,
    discount: l.discount ? Number(l.discount) : null,
    taxName: l.tax$_identifier || '',
    lineTotal: l.lineNetAmount ?? 0,
  }));

  const grandTotal = Number(header.grandTotalAmount ?? 0);
  const netAmount  = Number(header.summedLineAmount ?? 0);
  const taxAmount  = grandTotal - netAmount;

  const getGrossLine = (l) => {
    const qty = Number(l.orderedQuantity ?? 0);
    if (qty === 0) return 0;
    if (l.listPrice != null) return qty * Number(l.listPrice);
    const lineNet = Number(l.lineNetAmount ?? 0);
    const disc = Number(l.discount ?? 0);
    return disc > 0 ? lineNet / (1 - disc / 100) : lineNet;
  };
  const grossAmount = linesRaw.reduce((sum, l) => sum + getGrossLine(l), 0);
  const productNetAmount = linesRaw.reduce((sum, l) => sum + Number(l.lineNetAmount ?? 0), 0);
  const discountPerProduct = Math.max(0, grossAmount - productNetAmount);
  const etgoTotalDiscount = Number(header.etgoTotalDiscount ?? 0);
  const totalDiscountAmt = etgoTotalDiscount > 0 ? productNetAmount * etgoTotalDiscount / 100 : 0;

  const org = session?.organization ?? {};
  const customerAddressLines = buildLocationAddressLines(
    partnerLocation,
    header.partnerAddress$_identifier || null,
  );

  return {
    companyName:     org.name        || header.organization$_identifier || header.organization || 'Empresa',
    companyAddress1: org.address1    || null,
    companyAddress2: org.address2    || null,
    companyCityLine: org.cityLine    || null,
    companyTaxId:    org.taxId       || null,
    companyLogoDataUrl,
    documentNo: header.documentNo || '',
    invoiceDate: header.orderDate || '',
    validUntil: header.validUntil || null,
    customerName: header.businessPartner$_identifier || header.businessPartner || '—',
    hasCustomerAddress: customerAddressLines.length > 0,
    customerAddressLines,
    paymentMethod: header.paymentMethod$_identifier || null,
    paymentTerms: header.paymentTerms$_identifier || null,
    notes: header.description || null,
    lines,
    netAmount,
    taxAmount,
    grandTotal,
    grossAmount:        discountPerProduct > 0 ? grossAmount : null,
    discountPerProduct: discountPerProduct > 0 ? discountPerProduct : null,
    etgoTotalDiscount:  etgoTotalDiscount > 0 ? etgoTotalDiscount : null,
    totalDiscountAmt:   totalDiscountAmt > 0 ? totalDiscountAmt : null,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useQuotationPdf(quotationId, apiBaseUrl, token) {
  const ui = useUI();
  const labels = {
    title:           ui('quotationPdfTitle'),
    documentNo:      ui('quotationPdfDocumentNo'),
    taxId:           ui('invoicePdfTaxId'),
    page:            ui('invoicePdfPage'),
    customerSection: ui('invoicePdfCustomerSection'),
    documentSection: ui('quotationPdfSection'),
    customer:        ui('invoicePdfCustomer'),
    address:         ui('invoicePdfAddress'),
    date:            ui('quotationPdfDate'),
    validUntil:      ui('quotationPdfValidUntil'),
    paymentTerms:    ui('invoicePdfPaymentTerms'),
    paymentMethod:   ui('invoicePdfPaymentMethod'),
    colCode:         ui('invoicePdfColCode'),
    colDescription:  ui('invoicePdfColDescription'),
    colQty:          ui('quotationPdfColQty'),
    colUnitPrice:    ui('invoicePdfColUnitPrice'),
    colDiscount:     ui('invoicePdfColDiscount'),
    colTax:          ui('invoicePdfColTax'),
    colTotal:        ui('invoicePdfColTotal'),
    subtotal:                ui('invoicePdfSubtotal'),
    tax:                     ui('invoicePdfTax'),
    grandTotal:              ui('invoicePdfGrandTotal'),
    notes:                   ui('invoicePdfNotes'),
    subtotalWithoutDiscount: ui('subtotalWithoutDiscount'),
    discountPerProduct:      ui('discountPerProduct'),
    totalDiscount:           ui('totalDiscount'),
  };
  return useDocumentPdf(quotationId, apiBaseUrl, token, buildQuotationData, labels);
}
