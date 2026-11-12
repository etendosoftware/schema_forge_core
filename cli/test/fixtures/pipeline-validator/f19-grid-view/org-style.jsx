import { useMemo } from 'react';
const GRID_COLUMN_DEFS = [
  { key: 'name', column: 'Name', labelKey: 'name' },
  { key: 'searchKey', column: 'Value', labelKey: 'searchKey' },
];
export default function CustomTable({ data, ui }) {
  const gridColumns = useMemo(() => GRID_COLUMN_DEFS.map(({ labelKey, ...column }) => ({ ...column, label: ui(labelKey) })), [ui]);
  useFlaggedGridView({ spec: 'x', entity: 'y', columns: gridColumns, data });
  return null;
}
