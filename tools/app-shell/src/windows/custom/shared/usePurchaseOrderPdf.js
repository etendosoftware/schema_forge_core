import { useUI } from '@/i18n';
import { buildOrderData, useDocumentPdf } from './documentPdf.js';

const buildPurchaseOrderData = (orderId, base, token) => buildOrderData('purchase-order', orderId, base, token);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function usePurchaseOrderPdf(orderId, apiBaseUrl, token) {
  const ui = useUI();
  const labels = {
    title:           ui('purchaseOrderPdfTitle'),
    documentNo:      ui('purchaseOrderPdfDocumentNo'),
    taxId:           ui('invoicePdfTaxId'),
    page:            ui('invoicePdfPage'),
    customerSection: ui('invoicePdfCustomerSection'),
    documentSection: ui('purchaseOrderPdfSection'),
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
  return useDocumentPdf(orderId, apiBaseUrl, token, buildPurchaseOrderData, labels);
}
