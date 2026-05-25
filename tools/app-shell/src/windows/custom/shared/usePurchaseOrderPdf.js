import { useUI } from '@schema-forge/app-shell-core';
import { buildOrderData, buildDocumentPdfLabels, useDocumentPdf } from './documentPdf.js';

const buildPurchaseOrderData = (orderId, base, token) => buildOrderData('purchase-order', orderId, base, token);

export function usePurchaseOrderPdf(orderId, apiBaseUrl, token) {
  const ui = useUI();
  const labels = buildDocumentPdfLabels(ui, {
    title:           ui('purchaseOrderPdfTitle'),
    documentNo:      ui('purchaseOrderPdfDocumentNo'),
    documentSection: ui('purchaseOrderPdfSection'),
    date:            ui('orderPdfDate'),
    colQty:          ui('orderPdfColQty'),
  });
  return useDocumentPdf(orderId, apiBaseUrl, token, buildPurchaseOrderData, labels);
}
