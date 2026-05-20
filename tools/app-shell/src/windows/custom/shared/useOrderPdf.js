import { useUI } from '@/i18n';
import { buildOrderData, useDocumentPdf } from './documentPdf.js';

const buildSalesOrderData = (orderId, base, token) => buildOrderData('sales-order', orderId, base, token);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useOrderPdf(orderId, apiBaseUrl, token) {
  const ui = useUI();
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
  return useDocumentPdf(orderId, apiBaseUrl, token, buildSalesOrderData, labels);
}
