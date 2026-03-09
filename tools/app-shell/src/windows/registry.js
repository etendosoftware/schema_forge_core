import menuConfig from '../menu.json' with { type: 'json' };

/**
 * Known window loaders -- maps slug to dynamic import.
 * Windows not listed here fall back to PlaceholderWindow.
 *
 * Enterprise windows (removed): commission, commission-payment, requisition,
 * manage-requisitions, landed-cost, inventory-quality-inspection, bom-production,
 * packing, warehouse-picking-list, stock-reservation, cost-adjustment
 */
const windowLoaders = {
  'sales-order': () => import('@generated/sales-order/generated/web/sales-order/index.jsx'),
  'business-partner': () => import('@generated/business-partner/generated/web/business-partner/index.jsx'),
  'warehouse': () => import('@generated/warehouse/generated/web/warehouse/index.jsx'),
  'price-list': () => import('@generated/price-list/generated/web/price-list/index.jsx'),
  'payment-term': () => import('@generated/payment-term/generated/web/payment-term/index.jsx'),
  'payment-method': () => import('@generated/payment-method/generated/web/payment-method/index.jsx'),
  'product': () => import('@generated/product/generated/web/product/index.jsx'),
  'product-category': () => import('@generated/product-category/generated/web/product-category/index.jsx'),
  'tax': () => import('@generated/tax/generated/web/tax/index.jsx'),
  'uom': () => import('@generated/uom/generated/web/uom/index.jsx'),
  'user': () => import('@generated/user/generated/web/user/index.jsx'),
  'purchase-order': () => import('@generated/purchase-order/generated/web/purchase-order/index.jsx'),
  'goods-receipt': () => import('@generated/goods-receipt/generated/web/goods-receipt/index.jsx'),
  'purchase-invoice': () => import('@generated/purchase-invoice/generated/web/purchase-invoice/index.jsx'),
  'return-to-vendor': () => import('@generated/return-to-vendor/generated/web/return-to-vendor/index.jsx'),
  'return-to-vendor-shipment': () => import('@generated/return-to-vendor-shipment/generated/web/return-to-vendor-shipment/index.jsx'),
  'physical-inventory': () => import('@generated/physical-inventory/generated/web/physical-inventory/index.jsx'),
  'goods-movements': () => import('@generated/goods-movements/generated/web/goods-movements/index.jsx'),
  'warehouse-storage-bins': () => import('@generated/warehouse-storage-bins/generated/web/warehouse-storage-bins/index.jsx'),
  'sales-quotation': () => import('@generated/sales-quotation/generated/web/sales-quotation/index.jsx'),
  'goods-shipment': () => import('@generated/goods-shipment/generated/web/goods-shipment/index.jsx'),
  'return-from-customer': () => import('@generated/return-from-customer/generated/web/return-from-customer/index.jsx'),
  'return-material-receipt': () => import('@generated/return-material-receipt/generated/web/return-material-receipt/index.jsx'),
  'sales-invoice': () => import('@generated/sales-invoice/generated/web/sales-invoice/index.jsx'),
  'deal': () => import('@generated/deal/generated/web/deal/index.jsx'),
  'activity': () => import('@generated/activity/generated/web/activity/index.jsx'),
  'lead': () => import('@generated/lead/generated/web/lead/index.jsx'),
  'employee': () => import('@generated/employee/generated/web/employee/index.jsx'),
  'absence': () => import('@generated/absence/generated/web/absence/index.jsx'),
  'project': () => import('@generated/project/generated/web/project/index.jsx'),
  'time-tracking': () => import('@generated/time-tracking/generated/web/time-tracking/index.jsx'),
  'document': () => import('@generated/document/generated/web/document/index.jsx'),
  'recurring-invoice': () => import('@generated/recurring-invoice/generated/web/recurring-invoice/index.jsx'),
  'payment-in': () => import('@generated/payment-in/generated/web/payment-in/index.jsx'),
  'payment-out': () => import('@generated/payment-out/generated/web/payment-out/index.jsx'),
  'bank-reconciliation': () => import('@generated/bank-reconciliation/generated/web/bank-reconciliation/index.jsx'),
  'chart-of-accounts': () => import('@generated/chart-of-accounts/generated/web/chart-of-accounts/index.jsx'),
};

/**
 * Return the 2-level menu groups from menu.json.
 */
export function buildMenuGroups() {
  return menuConfig.menu;
}

/**
 * Flat list of all window slugs from menu.json.
 */
export function getAllWindowNames() {
  return menuConfig.menu.flatMap(g => g.items.map(i => i.name));
}

/**
 * Build window map with loaders for all windows in menu.json.
 */
export function buildWindowMap() {
  const map = {};
  for (const group of menuConfig.menu) {
    for (const item of group.items) {
      map[item.name] = {
        name: item.name,
        label: item.label,
        contract: null,
        loader: windowLoaders[item.name] || (() => import('./PlaceholderWindow.jsx')),
      };
    }
  }
  return map;
}
