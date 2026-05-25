import { useUI } from '@schema-forge/app-shell-core';
import { buildOrderData, buildDocumentPdfLabels, useDocumentPdf } from './documentPdf.js';

const buildSalesOrderData = (orderId, base, token) => buildOrderData('sales-order', orderId, base, token);

export function useOrderPdf(orderId, apiBaseUrl, token) {
  const ui = useUI();
  const labels = buildDocumentPdfLabels(ui, {
    title:           ui('orderPdfTitle'),
    documentNo:      ui('orderPdfDocumentNo'),
    documentSection: ui('orderPdfSection'),
    date:            ui('orderPdfDate'),
    colQty:          ui('orderPdfColQty'),
  });
  return useDocumentPdf(orderId, apiBaseUrl, token, buildSalesOrderData, labels);
}
