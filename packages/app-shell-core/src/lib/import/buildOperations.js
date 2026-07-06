const descriptors = new Map();

/**
 * Register a composite-entity import descriptor (e.g. Contacts = BusinessPartner +
 * LocationAddress + Contact) under a name referenced by decisions.json's
 * `import.descriptor`. Mirrors the shape of the OCR ingest descriptors
 * (`ocr/ingest/purchaseInvoiceDescriptor.js`) — a function from one row to the
 * `operations[]` array a single `/batch` call needs.
 */
export function registerImportDescriptor(name, fn) {
  descriptors.set(name, fn);
}

export function getImportDescriptor(name) {
  return descriptors.get(name);
}

/**
 * Default single-entity operation builder: one `create` op carrying exactly
 * the row's mapped/resolved target fields.
 */
export function buildDefaultOperations(row, { spec, entity, targets }) {
  const body = {};
  for (const target of targets) {
    body[target] = row[target];
  }
  return [{ id: 'row', spec, entity, body }];
}

export function buildOperations(row, config) {
  if (!config.descriptorName) {
    return buildDefaultOperations(row, config);
  }
  const descriptor = getImportDescriptor(config.descriptorName);
  if (!descriptor) {
    throw new Error(`No import descriptor registered: "${config.descriptorName}"`);
  }
  return descriptor(row, config);
}
