import { useMemo } from 'react';
const BASE = [{ key: 'searchKey', column: 'Value' }];
// `rows` only appears in the deps array: it is a genuine list and must still be checked.
const rows = [{ key: 'name', column: 'Name' }];
export default function CustomTable() {
  const gridColumns = useMemo(() => BASE.map(c => c), [rows]);
  useGridView({ columns: gridColumns });
  return <DataTable columns={rows} />;
}
