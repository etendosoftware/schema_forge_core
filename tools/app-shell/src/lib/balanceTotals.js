/**
 * computeBalance — pure aggregation for BalanceFooterPanel.
 *
 * Sums the debit and credit columns across saved lines plus any in-progress
 * add-row (pendingLine) and sidebar editing snapshot (editingLine), mirroring
 * the line-collection semantics of documentTotals.js.
 *
 * @param lines       - array of saved line row objects
 * @param pendingLine - optional in-progress add-row values
 * @param editingLine - optional sidebar editing values (must carry `id`)
 * @param config      - { debitField, creditField }
 * @returns { totalDebit, totalCredit, difference, isBalanced }
 */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const NOT_BALANCED = { totalDebit: 0, totalCredit: 0, difference: 0, isBalanced: false };

function applyEditingLine(lines, editingLine) {
  if (!editingLine?.id) return lines;
  return lines.map((l) => (l.id === editingLine.id ? { ...l, ...editingLine } : l));
}

function collectLines(lines, pendingLine, editingLine) {
  const safe = lines || [];
  const effective = applyEditingLine(safe, editingLine);
  return pendingLine ? [...effective, pendingLine] : effective;
}

function sumField(lines, field) {
  return lines.reduce((sum, line) => sum + (parseFloat(line?.[field] ?? 0) || 0), 0);
}

export function computeBalance(lines, pendingLine, editingLine, config) {
  if (!config?.debitField || !config?.creditField) return NOT_BALANCED;
  const all = collectLines(lines, pendingLine, editingLine);
  const totalDebit = round2(sumField(all, config.debitField));
  const totalCredit = round2(sumField(all, config.creditField));
  const difference = round2(totalDebit - totalCredit);
  const isBalanced = difference === 0 && totalDebit > 0;
  return { totalDebit, totalCredit, difference, isBalanced };
}
