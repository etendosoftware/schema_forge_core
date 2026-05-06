/**
 * computeDocumentTotals — pure aggregation for DocumentTotalsPanel.
 *
 * Returns null for any total that cannot be computed because the required
 * lineConfig fields are missing or the lines array is empty.
 *
 * @param lines         - array of line row objects (hook.children)
 * @param pendingLine   - optional in-progress add-row values (live snapshot)
 * @param editingLine   - optional sidebar editing values (live snapshot)
 * @param lineConfig    - { qtyField, priceField, discountField, grossField }
 * @param totalDiscountPct - optional document-level discount percentage (0–100)
 */

function applyEditingLine(lines, editingLine) {
  if (!editingLine?.id) return lines;
  return lines.map(l => l.id === editingLine.id ? { ...l, ...editingLine } : l);
}

export function computeDocumentTotals(
  lines,
  pendingLine,
  editingLine,
  lineConfig,
  totalDiscountPct = 0,
) {
  if (!lineConfig) return {
    grossSubtotal: null,
    netSubtotal: null,
    grandTotal: null,
    discountAmt: null,
    taxAmt: null,
    totalDiscountAmt: null,
  };

  const safeLines = lines || [];

  // Sidebar editing: replace the matching saved line with live sidebar values.
  const effectiveLines = applyEditingLine(safeLines, editingLine);

  // All lines to aggregate: effective saved lines + optional in-progress add-row.
  const allLines = pendingLine ? [...effectiveLines, pendingLine] : effectiveLines;

  const { qtyField, priceField, discountField, grossField } = lineConfig;

  const grossSubtotal = qtyField && priceField
    ? allLines.reduce((sum, line) => {
        const qty = parseFloat(line[qtyField] ?? 0) || 0;
        const price = parseFloat(line[priceField] ?? 0) || 0;
        return sum + qty * price;
      }, 0)
    : null;

  const netSubtotal = qtyField && priceField
    ? allLines.reduce((sum, line) => {
        const qty = parseFloat(line[qtyField] ?? 0) || 0;
        const price = parseFloat(line[priceField] ?? 0) || 0;
        const disc = discountField ? (parseFloat(line[discountField] ?? 0) || 0) : 0;
        return sum + qty * price * (1 - disc / 100);
      }, 0)
    : null;

  // Base grandTotal from line-level grossField (includes tax, before total discount).
  const baseGrandTotal = grossField
    ? allLines.reduce((sum, line) => {
        const g = parseFloat(line[grossField] ?? 0) || 0;
        return sum + g;
      }, 0)
    : null;

  const discountAmt = grossSubtotal != null && netSubtotal != null
    ? grossSubtotal - netSubtotal
    : null;

  // Total discount amount applied on top of per-product discounts.
  const pct = Math.max(0, Math.min(100, totalDiscountPct || 0));
  let totalDiscountAmt = null;
  if (netSubtotal != null) {
    totalDiscountAmt = pct > 0 ? netSubtotal * pct / 100 : 0;
  }

  // When a total discount is active, scale both grandTotal and taxAmt proportionally.
  // Tax stays proportional to the reduced base: taxAmt_new = taxAmt_base × (1 − pct/100).
  const factor = 1 - pct / 100;
  const grandTotal = baseGrandTotal != null
    ? baseGrandTotal * factor
    : null;

  const taxAmt = baseGrandTotal != null && netSubtotal != null
    ? (baseGrandTotal - netSubtotal) * factor
    : null;

  return { grossSubtotal, netSubtotal, grandTotal, discountAmt, taxAmt, totalDiscountAmt };
}
