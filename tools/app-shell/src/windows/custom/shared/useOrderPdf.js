import { useState, useEffect, useRef } from 'react';
import { useUI } from '@/i18n';
import { buildLocationAddressLines } from '@/lib/locationAddress.js';
import {
  fetchJson,
  fetchAll,
  fetchOptionalJson,
  fetchLocationAddress,
  fetchImageDataUrl,
  renderDocumentPdf,
} from './documentPdf.js';

// ---------------------------------------------------------------------------
// Build order data for the template
// ---------------------------------------------------------------------------
async function buildOrderData(orderId, base, token) {
  const [header, linesRaw, session] = await Promise.all([
    fetchJson(`${base}/sales-order/header/${orderId}`, token),
    fetchAll(`${base}/sales-order/lines?parentId=${orderId}`, token),
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
    quantity: l.orderedQuantity ?? l.qtyOrdered ?? 0,
    unitPrice: l.unitPrice ?? l.priceActual ?? 0,
    discount: l.discount ? Number(l.discount) : null,
    taxName: l.tax$_identifier || l.taxRate || '',
    lineTotal: l.lineNetAmount ?? l.lineAmount ?? 0,
  }));

  const grandTotal = Number(header.grandTotalAmount ?? 0);
  const netAmount  = Number(header.summedLineAmount ?? header.totalLines ?? 0);
  const taxAmount  = grandTotal - netAmount;

  const getGrossLine = (l) => {
    const qty = Number(l.orderedQuantity ?? l.qtyOrdered ?? 0);
    if (qty === 0) return 0;
    if (l.listPrice != null) return qty * Number(l.listPrice);
    const lineNet = Number(l.lineNetAmount ?? l.lineAmount ?? 0);
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
    header.partnerAddress$_identifier || header.bpAddress || null,
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
/**
 * useOrderPdf — fetches sales order data and renders it as a PDF via jsreport.
 *
 * @param {string|null} orderId    — the order record ID (null → no-op)
 * @param {string}      apiBaseUrl — e.g. "https://host/sws/neo/sales-order"
 * @param {string}      token      — Bearer token
 * @returns {{ pdfUrl: string|null, pdfBlob: Blob|null, loading: boolean, error: string|null }}
 */
export function useOrderPdf(orderId, apiBaseUrl, token) {
  const ui = useUI();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevUrlRef = useRef(null);

  useEffect(() => {
    if (!orderId || !apiBaseUrl || !token) return;

    const labels = {
      title:           ui('orderPdfTitle'),
      documentNo:      ui('orderPdfDocumentNo'),
      taxId:           ui('invoicePdfTaxId'),
      page:            ui('invoicePdfPage'),
      customerSection: ui('invoicePdfCustomerSection'),
      documentSection: ui('orderPdfSection'),
      customer:        ui('invoicePdfCustomer'),
      address:         ui('invoicePdfAddress'),
      date:            ui('orderPdfDate'),
      paymentTerms:    ui('invoicePdfPaymentTerms'),
      paymentMethod:   ui('invoicePdfPaymentMethod'),
      colCode:         ui('invoicePdfColCode'),
      colDescription:  ui('invoicePdfColDescription'),
      colQty:          ui('orderPdfColQty'),
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

    // Strip spec name: .../sws/neo/sales-order → .../sws/neo
    const base = apiBaseUrl.replace(/\/[^/]+$/, '');

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    setPdfBlob(null);

    (async () => {
      try {
        const data = await buildOrderData(orderId, base, token);
        const blob = await renderDocumentPdf({ ...data, labels });
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
  }, [orderId, apiBaseUrl, token]);

  return { pdfUrl, pdfBlob, loading, error };
}
