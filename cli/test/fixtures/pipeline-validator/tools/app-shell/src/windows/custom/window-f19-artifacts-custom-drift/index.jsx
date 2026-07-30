// Mirrors tools/app-shell/src/windows/custom/sales-invoice/index.jsx: a decoy
// column array that LOOKS like the live table but is dead code for rendering
// purposes (the real one is artifacts/<name>/custom/RealTable.jsx, imported
// via the @generated alias). This decoy is intentionally clean (no drift) to
// prove the artifacts/custom drift is caught independently of this file.
const LIST_COLUMNS = [
  { key: 'name', column: 'Name', type: 'string', required: true },
];

export default LIST_COLUMNS;
