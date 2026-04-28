import { useCallback } from 'react';

/**
 * Per-window line configuration.
 *
 * qtyField   — form key holding the editable quantity
 * grossField — form key to write the computed gross line amount
 *
 * Add a new entry here whenever a new window type is onboarded.
 */
export const LINE_CONFIGS = {
  order:   { qtyField: 'orderedQuantity',  grossField: 'lineGrossAmount' },
  invoice: { qtyField: 'invoicedQuantity', grossField: 'grossAmount'     },
};

// Convenience aliases — import the one that matches the window type.
export const ORDER_LINE_CONFIG   = LINE_CONFIGS.order;
export const INVOICE_LINE_CONFIG = LINE_CONFIGS.invoice;

// ─── Pure helpers (no React, fully testable) ──────────────────────────────────

/**
 * Resolves the tax factor (e.g. 1.21 for 21% VAT) from up to 5 sources:
 *   0. taxRate injected into calloutResult by the backend
 *   1. Selector aux data stored as rowValues.tax_rate
 *   2. In-memory cache (populated on source 0)
 *   3. Ratio of saved grossField / lineNetAmount from the current row (sidebar)
 *   4. Same ratio derived from any sibling saved line with the same tax id
 *
 * Mutates taxRateCache when source 0 resolves to populate future cache hits.
 *
 * @param {string|undefined}        taxId
 * @param {object}                  calloutResult
 * @param {object}                  rowValues
 * @param {Record<string,number>}   taxRateCache   Plain object (taxRateCacheRef.current)
 * @param {Array}                   siblings       Saved sibling lines (hook.children)
 * @param {string}                  grossField     Config: which field holds the line gross
 * @returns {number|null}
 */
export function resolveTaxFactor(taxId, calloutResult, rowValues, taxRateCache, siblings, grossField) {
  // 0. Backend-injected rate
  const calloutRate = parseFloat(String(calloutResult.taxRate ?? ''));
  if (!isNaN(calloutRate)) {
    if (taxId) taxRateCache[taxId] = calloutRate;
    return 1 + calloutRate / 100;
  }

  // 1. Selector aux data
  const auxRate = parseFloat(String(rowValues['tax_rate'] ?? ''));
  if (!isNaN(auxRate) && auxRate >= 0) return 1 + auxRate / 100;

  // 2. Cache from a previous callout
  if (taxId != null) {
    const cached = taxRateCache[taxId];
    if (cached != null) return 1 + cached / 100;
  }

  // 3. Ratio from current row's persisted amounts (sidebar)
  const savedGross = parseFloat(String(rowValues[grossField] ?? rowValues.grossAmount ?? '')) || 0;
  const savedNet   = parseFloat(String(rowValues.lineNetAmount ?? '')) || 0;
  if (savedGross > 0 && savedNet > 0) return savedGross / savedNet;

  // 4. Any sibling line with the same tax
  if (taxId != null) {
    const ref = (siblings || []).find(l => {
      if (l.tax !== taxId) return false;
      const gross = parseFloat(String(l[grossField] ?? l.grossAmount ?? l.lineGrossAmount ?? '')) || 0;
      if (gross <= 0) return false;
      const net = parseFloat(String(l.lineNetAmount ?? '')) || 0;
      if (net > 0) return true;
      const qty   = parseFloat(String(l.orderedQuantity ?? l.invoicedQuantity ?? '')) || 0;
      const price = parseFloat(String(l.unitPrice ?? '')) || 0;
      return qty > 0 && price > 0;
    });
    if (ref) {
      const gross   = parseFloat(String(ref[grossField] ?? ref.grossAmount ?? ref.lineGrossAmount ?? '')) || 0;
      const net     = parseFloat(String(ref.lineNetAmount ?? '')) || 0;
      const disc    = parseFloat(String(ref.discount ?? '')) || 0;
      const factor  = disc > 0 ? (1 - disc / 100) : 1;
      if (net > 0) return gross / (net * factor);
      const qty   = parseFloat(String(ref.orderedQuantity ?? ref.invoicedQuantity ?? '')) || 0;
      const price = parseFloat(String(ref.unitPrice ?? '')) || 0;
      const base  = qty * price * factor;
      if (base > 0) return gross / base;
    }
  }

  return null;
}

/**
 * Derives the taxable net amount for the changed field.
 * Always applies the active discount so the gross can be computed correctly.
 *
 * @param {string}        field        Changed field key
 * @param {string|number} value        New value
 * @param {object}        calloutResult
 * @param {object}        rowValues
 * @param {string}        qtyField     Config: which field holds the editable quantity
 * @returns {number}  0 when indeterminate
 */
export function deriveLineNet(field, value, calloutResult, rowValues, qtyField) {
  const disc       = parseFloat(String(rowValues.discount ?? '')) || 0;
  const discFactor = 1 - disc / 100;

  if (field === qtyField) {
    const qty   = parseFloat(value) || 0;
    const price = parseFloat(String(rowValues.unitPrice ?? '')) || 0;
    return qty > 0 && price > 0 ? qty * price * discFactor : 0;
  }

  if (field === 'unitPrice') {
    const qty   = parseFloat(String(rowValues[qtyField] ?? '')) || 0;
    const price = parseFloat(value) || 0;
    return qty > 0 && price > 0 ? qty * price * discFactor : 0;
  }

  if (field === 'discount') {
    const qty     = parseFloat(String(rowValues[qtyField] ?? '')) || 0;
    const price   = parseFloat(String(rowValues.unitPrice ?? '')) || 0;
    const newDisc = parseFloat(String(value)) || 0;
    return qty > 0 && price > 0 ? qty * price * (1 - newDisc / 100) : 0;
  }

  if (field === 'product') {
    // Prefer callout's lineNetAmount — it reflects the active price list.
    const calloutNet = parseFloat(String(calloutResult.lineNetAmount ?? calloutResult.lineNetAmt ?? '')) || 0;
    if (calloutNet > 0) return calloutNet;
    const qty      = parseFloat(String(rowValues[qtyField] ?? '')) || 0;
    const priceStr = calloutResult.unitPrice != null ? String(calloutResult.unitPrice) : String(rowValues.unitPrice ?? '');
    const price    = parseFloat(priceStr) || 0;
    return qty > 0 && price > 0 ? qty * price * discFactor : 0;
  }

  if (field === 'tax') {
    const qty   = parseFloat(String(rowValues[qtyField] ?? '')) || 0;
    const price = parseFloat(String(rowValues.unitPrice ?? '')) || 0;
    return qty > 0 && price > 0 ? qty * price * discFactor : 0;
  }

  return parseFloat(String(
    calloutResult.lineNetAmount ?? calloutResult.lineNetAmt ??
    rowValues.lineNetAmount     ?? rowValues.lineNetAmt     ?? ''
  )) || 0;
}

/**
 * Mutates calloutResult in place, adding grossAmount and the window-specific
 * gross field (lineGrossAmount for orders, grossAmount for invoices).
 *
 * No-op when the callout already returned a non-zero grossAmount.
 *
 * @param {string}        field
 * @param {string|number} value
 * @param {object}        calloutResult
 * @param {object}        rowValues
 * @param {Record<string,number>} taxRateCache
 * @param {Array}         siblings
 * @param {{ qtyField: string, grossField: string }} config
 */
export function computeLineGrossAmount(field, value, calloutResult, rowValues, taxRateCache, siblings, config) {
  if (calloutResult.grossAmount != null && Number(calloutResult.grossAmount) !== 0) return;

  const lineNet = deriveLineNet(field, value, calloutResult, rowValues, config.qtyField);
  if (lineNet <= 0) return;

  const taxId  = calloutResult.tax ?? rowValues.tax;
  const factor = resolveTaxFactor(taxId, calloutResult, rowValues, taxRateCache, siblings, config.grossField);
  if (factor === null) return;

  calloutResult.grossAmount = parseFloat((lineNet * factor).toFixed(2));

  // SL_Order_Amt misinterprets the stored lineGrossAmount as a unit price for
  // qty/price/discount/tax changes, so we always override for those fields.
  const forceOverride = [config.qtyField, 'unitPrice', 'discount', 'tax'].includes(field);
  if (forceOverride || calloutResult[config.grossField] == null || Number(calloutResult[config.grossField]) === 0) {
    calloutResult[config.grossField] = calloutResult.grossAmount;
  }
}

// ─── React hook ──────────────────────────────────────────────────────────────

/**
 * React hook that binds the pure helpers to the component's taxRateCacheRef
 * and children list, returning stable memoized functions.
 *
 * @param {React.MutableRefObject<Record<string,number>>} taxRateCacheRef
 * @param {Array}  children   Saved child lines (hook.children)
 * @param {{ qtyField: string, grossField: string }} [config]  Defaults to ORDER_LINE_CONFIG
 */
export function useLineGrossAmount(taxRateCacheRef, children, config = ORDER_LINE_CONFIG) {
  const boundResolveTaxFactor = useCallback(
    (taxId, calloutResult, rowValues) =>
      resolveTaxFactor(taxId, calloutResult, rowValues, taxRateCacheRef.current, children, config.grossField),
    [taxRateCacheRef, children, config.grossField],
  );

  const boundDeriveLineNet = useCallback(
    (field, value, calloutResult, rowValues) =>
      deriveLineNet(field, value, calloutResult, rowValues, config.qtyField),
    [config.qtyField],
  );

  const boundComputeLineGrossAmount = useCallback(
    (field, value, calloutResult, rowValues) =>
      computeLineGrossAmount(field, value, calloutResult, rowValues, taxRateCacheRef.current, children, config),
    [taxRateCacheRef, children, config],
  );

  return {
    computeLineGrossAmount: boundComputeLineGrossAmount,
    resolveTaxFactor:       boundResolveTaxFactor,
    deriveLineNet:          boundDeriveLineNet,
  };
}
