import { useMemo } from 'react';
import { DataTable } from '@/components/contract-ui';

const productRequired = true;

function useColumns() {
  // Mirrors the real InvoiceLinesTable.jsx pattern: `required` is spread in
  // conditionally at runtime. F18 cannot statically resolve this, so it must
  // be treated as indeterminate and skipped — never guessed as `false`, which
  // would otherwise false-positive against the contract's required=true.
  return useMemo(() => [
    { key: 'name', column: 'Name', type: 'string', required: true },
    { key: 'searchKey', column: 'Value', type: 'string', required: false },
    // 'stock' has no matching contract field — must be ignored, not flagged.
    { key: 'stock', type: 'custom', required: true },
    { key: 'product', column: 'M_Product_ID', type: 'selector', ...(productRequired ? { required: true } : {}) },
  ], []);
}

export default function CustomTable(props) {
  const columns = useColumns();
  return <DataTable columns={columns} {...props} />;
}
