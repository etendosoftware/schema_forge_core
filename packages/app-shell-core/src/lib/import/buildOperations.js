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

// Declared `async` even though the default path is fully synchronous: a registered
// composite descriptor (e.g. Contacts, which awaits FK resolution while building its
// Location op) may itself be async, returning a Promise<operations[]> instead of a plain
// array. A non-async buildOperations would hand that unresolved Promise straight to
// postBatch, which JSON.stringifies it as `{}` (a Promise has no enumerable own
// properties) — sent to /batch as `{"operations":{}}` and rejected outright. Declaring
// this function itself `async` makes every call site `await` it uniformly regardless of
// which path (sync default builder or async descriptor) actually ran.
export async function buildOperations(row, config) {
  if (!config.descriptorName) {
    return buildDefaultOperations(row, config);
  }
  const descriptor = getImportDescriptor(config.descriptorName);
  if (!descriptor) {
    throw new Error(`No import descriptor registered: "${config.descriptorName}"`);
  }
  return descriptor(row, config);
}
