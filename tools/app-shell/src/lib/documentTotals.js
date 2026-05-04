/**
 * computeDocumentTotals — pure aggregation for DocumentTotalsPanel.
 *
 * Returns null for any total that cannot be computed because the required
 * lineConfig fields are missing or the lines array is empty.
 */
export function computeDocumentTotals(lines = [], pendingLine, editingLine, lineConfig) {
  if (!lineConfig) return { grossSubtotal: null, netSubtotal: null, grandTotal: null, discountAmt: null, taxAmt: null };

  // Sidebar editing: replace the matching saved line with live sidebar values.
  const effectiveLines = editingLine?.id
    ? lines.map(l => l.id === editingLine.id ? { ...l, ...editingLine } : l)
    : lines;

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

  const grandTotal = grossField
    ? allLines.reduce((sum, line) => {
        const g = parseFloat(line[grossField] ?? 0) || 0;
        return sum + g;
      }, 0)
    : null;

  const discountAmt = grossSubtotal != null && netSubtotal != null
    ? grossSubtotal - netSubtotal
    : null;

  const taxAmt = grandTotal != null && netSubtotal != null
    ? grandTotal - netSubtotal
    : null;

  return { grossSubtotal, netSubtotal, grandTotal, discountAmt, taxAmt };
}
