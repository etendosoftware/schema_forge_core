/**
 * Convert a window name to a URL-safe slug.
 * 'Sales Order' → 'sales-order'
 */
function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Known window loaders — maps slug to dynamic import.
 * Add new entries here when generating new windows.
 */
const windowLoaders = {
  'sales-order': () => import('@generated/web/sales-order/index.jsx'),
};

/**
 * Build menu items from a contract.json — one item per window.
 */
export function buildMenuFromContract(contract) {
  const window = contract?.frontendContract?.window;
  if (!window) return [];

  return [{
    name: toSlug(window.name),
    label: window.name,
  }];
}

/**
 * Build window map with a loader for the window's generated component.
 */
export function buildWindowMap(contract) {
  const fc = contract?.frontendContract;
  if (!fc?.window) return {};

  const slug = toSlug(fc.window.name);

  return {
    [slug]: {
      name: slug,
      label: fc.window.name,
      contract: fc,
      loader: windowLoaders[slug] || (() =>
        import('./PlaceholderWindow.jsx')
      ),
    },
  };
}
