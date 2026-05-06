import { useCallback, useEffect, useState } from 'react';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import { getOcrDocType } from './ocrDocTypes';
import { useBatch } from './ingest/useBatch';
import { buildPurchaseInvoiceBatch } from './ingest/purchaseInvoiceDescriptor';
import ContactCreatePopup from './ContactCreatePopup';
import ProductResolverPopup from './ProductResolverPopup';

/* eslint-disable react/prop-types */

/**
 * Map a doc-type id to the descriptor that turns its OCR JSON into a list of
 * batch operations. Adding a new window is one line in this registry plus the
 * descriptor file itself — no other code in this hook changes.
 */
const DESCRIPTORS = {
  'purchase-invoice': buildPurchaseInvoiceBatch,
};

/**
 * Drives the OCR-to-batch flow:
 *
 *   1. Listen for the per-doctype window event the extractor dispatches.
 *   2. Hand the extracted JSON to the descriptor; the descriptor decides
 *      what client-side lookups to run and surfaces a popup (e.g.
 *      ContactCreatePopup) if a prerequisite needs the user.
 *   3. POST the resulting batch to /sws/neo/batch — atomic create or rollback.
 *   4. Toast the outcome and refresh the form.
 *
 * The hook is intentionally thin. There is no per-record orchestration left
 * (no visibility poll, no N+1 line POSTs, no allSettled bookkeeping); the
 * server owns the transaction and the descriptor owns the per-window mapping.
 */
export function useOcrFlow({
  docTypeId,
  token,
  apiBaseUrl,
  onRefresh,
} = {}) {
  const docType = getOcrDocType(docTypeId);
  const { runBatch } = useBatch({ apiBaseUrl, token });
  const { showResult } = useBulkActionToast();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [pendingModal, setPendingModal] = useState(null);

  // Returns a Promise that resolves when the rendered modal calls `resolve`.
  // Used by descriptor callbacks (e.g. askUserForBp) to pause until the user
  // confirms or cancels — agents bypass this entirely.
  const openModal = useCallback((render) => new Promise((resolve) => {
    const close = (value) => {
      setPendingModal(null);
      resolve(value);
    };
    setPendingModal(() => render({ resolve: close }));
  }), []);

  const askUserForBp = useCallback(({ prefilled }) => openModal(({ resolve }) => (
    <ContactCreatePopup
      item={{ kind: 'createContact', payload: { prefilled } }}
      apiBaseUrl={apiBaseUrl}
      token={token}
      onSubmit={(decision) => resolve(decision?.fields || null)}
      onCancel={() => resolve(null)}
    />
  )), [apiBaseUrl, token, openModal]);

  const askUserForProducts = useCallback(({ unmatched, selectorUrl, productSpecUrl }) => openModal(({ resolve }) => (
    <ProductResolverPopup
      unmatched={unmatched}
      selectorUrl={selectorUrl}
      productSpecUrl={productSpecUrl}
      token={token}
      onSubmit={(picks) => resolve(picks)}
      onCancel={() => resolve(null)}
    />
  )), [token, openModal]);

  useEffect(() => {
    if (!docType?.eventName) return undefined;
    const buildBatch = DESCRIPTORS[docType.id];
    if (!buildBatch) {
      console.warn('[OCR] no descriptor registered for docType', docType.id);
      return undefined;
    }

    const handler = async (event) => {
      const payload = event.detail || {};
      setLoading(true);
      setResult(null);
      try {
        const built = await buildBatch(payload, { token, apiBaseUrl, askUserForBp, askUserForProducts });
        if (!built || built.cancelled) {
          showResult({ ok: 0, failed: [{ reason: 'cancelled_by_user' }] });
          setResult({ committed: false, cancelled: true });
          return;
        }
        const ops = built.ops || [];
        const unmatched = built.unmatched || [];
        if (ops.length === 0) {
          showResult({ ok: 0, failed: [{ reason: 'empty_batch' }] });
          setResult({ committed: false, error: 'Empty batch' });
          return;
        }
        console.log('[OCR][batch] POSTing', ops.length, 'op(s)');
        const response = await runBatch(ops);
        if (response?.committed) {
          const recordOps = response.operations || [];
          const headerOp = recordOps.find(o => o.id === 'inv');
          const lineCount = recordOps.filter(o => /^ln\d+$/.test(o.id || '')).length;
          showResult({
            ok: 1 + lineCount,
            failed: unmatched.map(name => ({ reason: `product_not_found: ${name}` })),
          });
          setResult({
            committed: true,
            recordId: headerOp?.recordId,
            linesCreated: lineCount,
            linesFailed: 0,
            unresolved: unmatched,
          });
          onRefresh?.(headerOp?.recordId);
        } else {
          const message = response?.error?.message
            || `Operation '${response?.failedAt?.id}' failed`;
          console.warn('[OCR][batch] not committed', response);
          showResult({ ok: 0, failed: [{ reason: message }] });
          setResult({
            committed: false,
            error: message,
            failedAt: response?.failedAt,
          });
        }
      } catch (e) {
        console.error('[OCR][batch] flow failed', e);
        showResult({ ok: 0, failed: [{ reason: e?.message || 'flow_failed' }] });
        setResult({ committed: false, error: e?.message });
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener(docType.eventName, handler);
    return () => window.removeEventListener(docType.eventName, handler);
  }, [docType, token, apiBaseUrl, askUserForBp, askUserForProducts, runBatch, showResult, onRefresh]);

  return { result, loading, pendingModal };
}

export default useOcrFlow;
