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
    eventName: 'copilot:ocr-prefill:purchase-invoice',
    question: 'Extract all invoice fields: vendor name, document number, invoice date, line items (description, quantity, unit price). Return strict JSON.',
    // AD_Tab_ID of the Purchase Invoice header tab. Required by the AttachFile
    // webhook so the uploaded PDF lands in the AD_Attachment grid for the new
    // record. Look up via: SELECT ad_tab_id FROM ad_tab JOIN ad_window USING(ad_window_id)
    // WHERE ad_window.name='Purchase Invoice' AND tablevel=0.
    tabId: '290',
    tableName: 'C_Invoice',
    headerFields: [
      {
        key: 'vendor',
        kind: 'entity',
        label: 'ocrReviewVendorLabel',
        extractFrom: ['vendor_name', 'tax_id'],
        entitySpec: 'contacts/businessPartner',
        filter: 'active = true',
        preResolve: 'findBp',
        createComponent: 'CreateContactModal',
        createDocumentType: 'purchase',
        createPrefilledFrom: {
          name: 'vendor_name',
        },
      },
      {
        key: 'documentNo',
        kind: 'text',
        label: 'ocrReviewDocumentNoLabel',
        extractFrom: 'document_no',
        placeholder: 'ocrReviewDocumentNoPlaceholder',
      },
      {
        key: 'invoiceDate',
        kind: 'date',
        label: 'ocrReviewInvoiceDateLabel',
        extractFrom: 'invoice_date',
      },
    ],
    lineColumns: [
      {
        key: 'description',
        kind: 'text',
        label: 'ocrLinesColDescription',
        extractFrom: 'description',
      },
      {
        key: 'quantity',
        kind: 'number',
        label: 'ocrLinesColQuantity',
        extractFrom: 'quantity',
        width: 'w-24',
      },
      {
        key: 'unitPrice',
        kind: 'number',
        label: 'ocrLinesColUnitPrice',
        extractFrom: 'unit_price',
        width: 'w-28',
      },
      {
        key: 'tax',
        kind: 'entity',
        label: 'ocrLinesColTax',
        extractFrom: 'tax_label',
        entitySpec: 'tax/tax',
        preResolve: 'findTax',
        emptyOptionLabel: 'ocrLinesTaxDefault',
        searchPlaceholder: 'ocrLinesTaxSearch',
        noMatchesLabel: 'ocrLinesTaxNoMatches',
        clearLabel: 'ocrLinesTaxClear',
        width: 'w-48',
      },
    ],
    // Line-level fields the descriptor needs but the review modal doesn't
    // surface. Fed into the LLM output schema by buildOcrSchema.
    extraLineFields: [
      {
        name: 'tax_rate',
        kind: 'number',
        description: "Numeric tax percentage on this line if printed (e.g., 21.0 for '21%' or 'IVA 21%'). Null if only a textual label is shown or no tax info is present.",
      },
    ],
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
