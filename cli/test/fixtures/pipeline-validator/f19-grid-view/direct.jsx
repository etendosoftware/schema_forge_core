import { useMemo } from 'react';
export default function CustomTable() {
  const gridColumns = useMemo(() => [
    { key: 'name', column: 'Name', type: 'string' },
    { key: 'searchKey', column: 'Value', type: 'string' },
  ], []);
  useGridView({ spec: 'x', columns: gridColumns });
  return null;
}
