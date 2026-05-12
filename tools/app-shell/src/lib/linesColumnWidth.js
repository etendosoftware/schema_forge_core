/**
 * Column-width helpers shared between InlineLinesPanel (flex layout used while
 * displaying rows) and DataTable's inline-add row (HTML table layout used while
 * filling a new line). Keeping a single source of truth here means both
 * renderers compute the same widths and the header text wraps identically
 * regardless of which is mounted.
 */

/**
 * Returns the CSS `flex` shorthand for a lines-table column.
 * Used by InlineLinesPanel's flex column layout.
 */
export function columnFlex(col, idx) {
  if (col.type === 'amount') return '0 0 160px';
  if (col.type === 'price') return '0 0 140px';
  if (col.type === 'quantity' || col.type === 'integer') return '0 0 90px';
  if (col.type === 'decimal' || col.type === 'percent') return '0 0 100px';
  if (idx === 0) return '1 1 180px';
  if (col.type === 'string' || col.type === 'text') return '2 1 180px';
  if (col.type === 'selector' || col.type === 'search' || col.type === 'foreignKey') return '1 1 160px';
  if (col.type === 'enum' || col.type === 'select') return '1 1 220px';
  if (col.type === 'date') return '1 1 130px';
  return '0 0 120px';
}

/**
 * Returns just the basis (preferred width) in pixels for a column. Used by
 * DataTable's HTML table layout to set `minWidth` on TableHead/TableCell so
 * the auto-layout can't shrink columns below the flex baseline used in the
 * display table — keeping header wrapping consistent across both modes.
 */
export function columnMinWidthPx(col, idx) {
  if (col.type === 'amount') return 160;
  if (col.type === 'price') return 140;
  if (col.type === 'quantity' || col.type === 'integer') return 90;
  if (col.type === 'decimal' || col.type === 'percent') return 100;
  if (idx === 0) return 180;
  if (col.type === 'string' || col.type === 'text') return 180;
  if (col.type === 'selector' || col.type === 'search' || col.type === 'foreignKey') return 160;
  if (col.type === 'enum' || col.type === 'select') return 220;
  if (col.type === 'date') return 130;
  return 120;
}
