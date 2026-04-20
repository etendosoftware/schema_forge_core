export const CONFIGS = {
  sales: {
    type: 'sales',
    title: 'Quick Sales Order',
    titleEs: 'Orden de venta rápida',
    headerPath: '/neo/sales-order/sales-order',
    linesPath: '/neo/sales-order/sales-order-line',
    bpCriteria: [{ fieldName: 'isCustomer', operator: 'equals', value: 'Y' }],
    plCriteria: [{ fieldName: 'isSalesPriceList', operator: 'equals', value: 'Y' }],
  },
  purchase: {
    type: 'purchase',
    title: 'Quick Purchase Order',
    titleEs: 'Orden de compra rápida',
    headerPath: '/neo/purchase-order/purchase-order',
    linesPath: '/neo/purchase-order/purchase-order-line',
    bpCriteria: [{ fieldName: 'isVendor', operator: 'equals', value: 'Y' }],
    plCriteria: [{ fieldName: 'isSalesPriceList', operator: 'equals', value: 'N' }],
  },
};

export function configFromLocation(search = window.location.search) {
  const type = new URLSearchParams(search).get('type') || 'sales';
  const cfg = CONFIGS[type];
  if (!cfg) throw new Error(`Unknown quick-order type: ${type}`);
  return cfg;
}
