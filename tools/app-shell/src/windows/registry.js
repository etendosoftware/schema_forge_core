/**
 * Convert a window name to a URL-safe slug.
 * 'Sales Order' -> 'sales-order'
 */
function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Known window loaders -- maps slug to dynamic import.
 */
const windowLoaders = {
  'sales-order': () => import('@generated/sales-order/generated/web/sales-order/index.jsx'),
  'business-partner': () => import('@generated/business-partner/generated/web/business-partner/index.jsx'),
  'bp-location': () => import('@generated/bp-location/generated/web/bp-location/index.jsx'),
  'warehouse': () => import('@generated/warehouse/generated/web/warehouse/index.jsx'),
  'price-list': () => import('@generated/price-list/generated/web/price-list/index.jsx'),
  'payment-term': () => import('@generated/payment-term/generated/web/payment-term/index.jsx'),
  'payment-method': () => import('@generated/payment-method/generated/web/payment-method/index.jsx'),
  'product': () => import('@generated/product/generated/web/product/index.jsx'),
  'tax': () => import('@generated/tax/generated/web/tax/index.jsx'),
  'uom': () => import('@generated/uom/generated/web/uom/index.jsx'),
  'user': () => import('@generated/user/generated/web/user/index.jsx'),
};

/**
 * Reference windows -- simple CRUD entities used as FK targets by Sales Order.
 */
const REFERENCE_WINDOWS = [
  { name: 'business-partner', label: 'Business Partner' },
  { name: 'bp-location', label: 'BP Location' },
  { name: 'warehouse', label: 'Warehouse' },
  { name: 'price-list', label: 'Price List' },
  { name: 'payment-term', label: 'Payment Term' },
  { name: 'payment-method', label: 'Payment Method' },
  { name: 'product', label: 'Product' },
  { name: 'tax', label: 'Tax' },
  { name: 'uom', label: 'UOM' },
  { name: 'user', label: 'User' },
];

/**
 * Build menu items from a contract.json -- includes the primary window plus all reference windows.
 */
export function buildMenuFromContract(contract) {
  const items = [];

  const window = contract?.frontendContract?.window;
  if (window) {
    items.push({
      name: toSlug(window.name),
      label: window.name,
    });
  }

  for (const ref of REFERENCE_WINDOWS) {
    items.push(ref);
  }

  return items;
}

/**
 * Build window map with loaders for all windows.
 */
export function buildWindowMap(contract) {
  const map = {};

  const fc = contract?.frontendContract;
  if (fc?.window) {
    const slug = toSlug(fc.window.name);
    map[slug] = {
      name: slug,
      label: fc.window.name,
      contract: fc,
      loader: windowLoaders[slug] || (() => import('./PlaceholderWindow.jsx')),
    };
  }

  for (const ref of REFERENCE_WINDOWS) {
    if (!map[ref.name]) {
      map[ref.name] = {
        name: ref.name,
        label: ref.label,
        contract: null,
        loader: windowLoaders[ref.name] || (() => import('./PlaceholderWindow.jsx')),
      };
    }
  }

  return map;
}
