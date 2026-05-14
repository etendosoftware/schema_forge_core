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
// Build invoice data for the template
// ---------------------------------------------------------------------------
async function buildInvoiceData(invoiceId, base, token) {
  // Fetch header and lines in parallel
  const [header, linesRaw, session] = await Promise.all([
    fetchJson(`${base}/sales-invoice/header/${invoiceId}`, token),
    fetchAll(`${base}/sales-invoice/lines?parentId=${invoiceId}`, token),
    fetchOptionalJson(`${base}/session`, token),
  ]);
  const [companyLogoDataUrl, partnerLocation] = await Promise.all([
    fetchImageDataUrl(session?.yourCompanyDocumentImageId, base, token),
    fetchLocationAddress(header.partnerAddress, base, token),
  ]);

  // Sort by ERP lineNo so the rows always appear in the order the user created them
  const linesSorted = [...linesRaw].sort(
    (a, b) => (Number(a.lineNo) || 0) - (Number(b.lineNo) || 0)
  );
  const lines = linesSorted.map((l, idx) => ({
    lineNo: l.lineNo || (idx + 1),
    productName: l.product$_identifier || l.description || '—',
    quantity: l.invoicedQuantity ?? l.qtyInvoiced ?? 0,
    unitPrice: l.unitPrice ?? l.priceActual ?? 0,
    discount: l.discount ? Number(l.discount) : null,
    taxName: l.tax$_identifier || l.taxRate || '',
    lineTotal: l.lineNetAmount ?? l.lineAmount ?? 0,
  }));

  const grandTotal = Number(header.grandTotalAmount ?? 0);
  const netAmount  = Number(header.summedLineAmount ?? header.totalLines ?? 0);
  const taxAmount  = grandTotal - netAmount;

  const org = session?.organization ?? {};
  const customerAddressLines = buildLocationAddressLines(
    partnerLocation,
    header.partnerAddress$_identifier || header.bpAddress || null,
  );

  return {
    // Company (issuer) — from session.organization with header fallback
    companyName:     org.name        || header.organization$_identifier || header.organization || 'Empresa',
    companyAddress1: org.address1    || null,
    companyAddress2: org.address2    || null,
    companyCityLine: org.cityLine    || null,
    companyTaxId:    org.taxId       || null,
    companyLogoDataUrl,
    // Invoice
    documentNo: header.documentNo || '',
    invoiceDate: header.invoiceDate || header.dateInvoiced || '',
    // Customer
    customerName: header.businessPartner$_identifier || header.businessPartner || '—',
    hasCustomerAddress: customerAddressLines.length > 0,
    customerAddressLines,
    // Payment
    paymentMethod: header.paymentMethod$_identifier || null,
    paymentTerms: header.paymentTerms$_identifier || null,
    // Notes
    notes: header.description || null,
    // Lines
    lines,
    // Totals
    netAmount,
    taxAmount,
    grandTotal,
  };
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
 * @returns {{ pdfUrl: string|null, pdfBlob: Blob|null, loading: boolean, error: string|null }}
 */
export function useInvoicePdf(invoiceId, apiBaseUrl, token) {
  const ui = useUI();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevUrlRef = useRef(null);

  useEffect(() => {
    if (!invoiceId || !apiBaseUrl || !token) return;

    // Build labels from i18n for the current locale
    const labels = {
      title:           ui('invoicePdfTitle'),
      documentNo:      ui('invoicePdfDocumentNo'),
      taxId:           ui('invoicePdfTaxId'),
      page:            ui('invoicePdfPage'),
      customerSection: ui('invoicePdfCustomerSection'),
      documentSection: ui('invoicePdfInvoiceSection'),
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
    setPdfBlob(null);

    (async () => {
      try {
        const data = await buildInvoiceData(invoiceId, base, token);
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
  }, [invoiceId, apiBaseUrl, token]);

  return { pdfUrl, pdfBlob, loading, error };
}
