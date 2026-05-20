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

// Bank-style rounding to 2 decimal places for monetary amounts.
// Used to keep the grand total equal to the sum of the displayed (rounded)
// subtotal and tax — see comment near grandTotal below.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

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

  const taxAmt = baseGrandTotal != null && netSubtotal != null
    ? (baseGrandTotal - netSubtotal) * factor
    : null;

  // grandTotal is the sum of the rounded (displayed) subtotal and tax — NOT
  // round(exact_subtotal + exact_tax). This matches the accounting/legal
  // convention used by Etendo Classic and AEAT-compliant invoices: the printed
  // total must equal the visible "subtotal" plus "tax" lines, with no 1-cent
  // double-rounding drift (e.g. 37.224 + 3.7224 → displayed 37.22 + 3.72 = 40.94,
  // not round(40.9464) = 40.95).
  const grandTotal = baseGrandTotal != null && netSubtotal != null
    ? round2(netSubtotal * factor) + round2(taxAmt)
    : (baseGrandTotal != null ? round2(baseGrandTotal * factor) : null);

  return { grossSubtotal, netSubtotal, grandTotal, discountAmt, taxAmt, totalDiscountAmt };
}
