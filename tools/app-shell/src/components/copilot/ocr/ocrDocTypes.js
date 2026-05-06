/**
 * OCR document-type registry.
 *
 * Each entry binds a URL route prefix to the extraction config (which copilot
 * assistant tool runs and what JSON schema it returns) and the per-doctype
 * window event the extractor dispatches. The actual mapping from extracted
 * JSON to a `/sws/neo/batch` payload lives in a per-window descriptor under
 * `ingest/<window>Descriptor.js` and is wired up in `useOcrFlow.jsx`'s
 * DESCRIPTORS map — adding a new window is one descriptor file plus one
 * entry here.
 */

export const OCR_DOC_TYPES = [
  {
    id: 'purchase-invoice',
    routePrefix: '/purchase-invoice/',
    toolName: 'SimpleOcrTool',
    structuredOutput: 'Invoice',
    eventName: 'copilot:ocr-prefill:purchase-invoice',
    question: 'Extract all invoice fields: vendor name, document number, invoice date, line items (description, quantity, unit price). Return strict JSON.',
  },
];

export const OCR_PREFILL_EVENT_PREFIX = 'copilot:ocr-prefill:';

/**
 * Return the OCR config for the current pathname, or null when no document
 * type matches.
 */
export function matchOcrDocType(pathname) {
  if (!pathname) return null;
  return OCR_DOC_TYPES.find(t => pathname.startsWith(t.routePrefix)) || null;
}

export function getOcrDocType(docTypeId) {
  if (!docTypeId) return null;
  return OCR_DOC_TYPES.find(t => t.id === docTypeId) || null;
}
