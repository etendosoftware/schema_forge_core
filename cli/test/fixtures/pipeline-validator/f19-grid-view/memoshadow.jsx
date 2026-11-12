import { useMemo } from 'react';
const columns = [{ key: 'name', column: 'Name' }];
const base = [{ key: 'searchKey', column: 'Value' }];
export function Plain() { return <T columns={columns} />; }
export default function CustomTable() {
  const g = useMemo(() => base.items.map(columns => columns.x), [base]);
  useGridView({ columns: g });
  return null;
}
