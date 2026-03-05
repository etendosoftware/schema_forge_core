/**
 * Convert camelCase entity name to display label.
 * 'orderLine' → 'Order Line'
 */
function toLabel(name) {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

/**
 * Build menu items from a contract.json frontendContract.
 */
export function buildMenuFromContract(contract) {
  const entities = contract?.frontendContract?.entities;
  if (!entities) return [];

  return Object.keys(entities).map(name => ({
    name,
    label: toLabel(name),
  }));
}

/**
 * Build window map with loaders for each entity.
 * loaders: { entityName: () => import('...') }
 * Falls back to a placeholder component if no loader is provided.
 */
export function buildWindowMap(contract, loaders = {}) {
  const entities = contract?.frontendContract?.entities;
  if (!entities) return {};

  const map = {};
  for (const name of Object.keys(entities)) {
    map[name] = {
      name,
      label: toLabel(name),
      entityConfig: entities[name],
      loader: loaders[name] || (() =>
        import('./PlaceholderWindow.jsx')
      ),
    };
  }
  return map;
}
