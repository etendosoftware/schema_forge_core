import menuConfig from '../menu.json' with { type: 'json' };
import { APP_CATALOG } from '../apps-registry.js';

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
  'contacts': () => import('@generated/contacts/generated/web/contacts/index.jsx'),
  'warehouse': () => import('@generated/warehouse/generated/web/warehouse/index.jsx'),
  'price-list': () => import('@generated/price-list/generated/web/price-list/index.jsx'),
  'payment-term': () => import('@generated/payment-term/generated/web/payment-term/index.jsx'),
  'payment-method': () => import('@generated/payment-method/generated/web/payment-method/index.jsx'),
  'product': () => import('@generated/product/generated/web/product/index.jsx'),
  'product-category': () => import('@generated/product-category/generated/web/product-category/index.jsx'),
  'tax': () => import('@generated/tax/generated/web/tax/index.jsx'),
  'unit-of-measure': () => import('@generated/unit-of-measure/generated/web/unit-of-measure/index.jsx'),
  'user': () => import('@generated/user/generated/web/user/index.jsx'),
  'purchase-order': () => import('@generated/purchase-order/generated/web/purchase-order/index.jsx'),
  'goods-receipt': () => import('@generated/goods-receipt/generated/web/goods-receipt/index.jsx'),
  'return-to-vendor': () => import('@generated/return-to-vendor/generated/web/return-to-vendor/index.jsx'),
  'return-to-vendor-shipment': () => import('@generated/return-to-vendor-shipment/generated/web/return-to-vendor-shipment/index.jsx'),
  'physical-inventory': () => import('@generated/physical-inventory/generated/web/physical-inventory/index.jsx'),
  'goods-movements': () => import('@generated/goods-movements/generated/web/goods-movements/index.jsx'),
  'internal-consumption': () => import('@generated/internal-consumption/generated/web/internal-consumption/index.jsx'),
  'warehouse-storage-bins': () => import('@generated/warehouse-storage-bins/generated/web/warehouse-storage-bins/index.jsx'),
  'sales-quotation': () => import('@generated/sales-quotation/generated/web/sales-quotation/index.jsx'),
  'goods-shipment': () => import('@/windows/custom/goods-shipment/index.jsx'),
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
  'assets': () => import('@generated/assets/generated/web/assets/index.jsx'),
};

/**
 * Return the 2-level menu groups, merging installed SDK apps into the
 * Marketplace group. Groups or items with hidden: true are excluded.
 *
 * @param {string[]} [installedAppIds] — appIds present in the installed-apps
 *   store. External apps only appear in the menu when their id is here.
 */
export function buildMenuGroups(installedAppIds = []) {
  const installedSet = new Set(installedAppIds);
  const extraByGroup = new Map();
  for (const app of APP_CATALOG) {
    if (!installedSet.has(app.appId)) continue;
    if (!extraByGroup.has(app.menuGroup)) extraByGroup.set(app.menuGroup, []);
    for (const entry of app.menuEntries) {
      extraByGroup.get(app.menuGroup).push({ ...entry });
    }
  }

  return menuConfig.menu
    .filter(group => !group.hidden)
    .map(group => {
      const extras = extraByGroup.get(group.group) || [];
      return {
        ...group,
        items: [
          ...group.items.filter(item => !item.hidden),
          ...extras,
        ],
      };
    });
}

/**
 * Flat list of all window slugs from menu.json plus every potential menu
 * entry from the app catalog (so route resolution never fails for an app
 * that happens to be installed).
 */
export function getAllWindowNames() {
  const names = menuConfig.menu.flatMap(g => g.items.map(i => i.name));
  for (const app of APP_CATALOG) {
    for (const entry of app.menuEntries) {
      if (!names.includes(entry.name)) names.push(entry.name);
    }
  }
  return names;
}

/**
 * Hand-written custom window loaders.
 * Each entry maps a window slug to a dynamic import of its custom component.
 * Entries are auto-registered by the pipeline when layoutType is "custom".
 * Developers can also add entries manually for fully custom windows.
 */
const customLoaders = {
  // Auto-registered by pipeline when layoutType: "custom"
  'sales-order': () => import('./custom/sales-order/index.jsx'),
  'price-list': () => import('./custom/price-list/index.jsx'),
  'purchase-invoice': () => import('./custom/purchase-invoice/index.jsx'),
  'purchase-order': () => import('./custom/purchase-order/index.jsx'),
  'goods-receipt': () => import('./custom/goods-receipt/index.jsx'),
  'payment-out': () => import('./custom/payment-out/index.jsx'),
  'sales-order': () => import('./custom/sales-order/index.jsx'),
  'sales-invoice': () => import('./custom/sales-invoice/index.jsx'),
  'warehouse': () => import('./custom/warehouse/index.jsx'),
  'spike-hello-app': () => import('./spike-apps-host/index.jsx'),
  'quick-order-sales': () => import('./quick-order/index.jsx'),
  'quick-order-purchase': () => import('./quick-order/index.jsx'),
};

/**
 * Build window map with loaders for all windows in menu.json plus every
 * SDK-app menu entry from the catalog (so installing an app from the
 * App Store never hits PlaceholderWindow on first render).
 *
 * Resolution order: customLoaders > windowLoaders > PlaceholderWindow
 */
export function buildWindowMap() {
  const map = {};
  const register = (item) => {
    map[item.name] = {
      name: item.name,
      label: item.label,
      contract: null,
      loader: customLoaders[item.name]
        || windowLoaders[item.name]
        || (() => import('./PlaceholderWindow.jsx')),
    };
  };

  for (const group of menuConfig.menu) {
    for (const item of group.items) register(item);
  }
  for (const app of APP_CATALOG) {
    for (const entry of app.menuEntries) {
      if (!map[entry.name]) register(entry);
    }
  }
  return map;
}
