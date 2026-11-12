export function Genuine() {
  const columns = [{ key: 'name', column: 'Name' }];
  return <DataTable columns={columns} />;
}
export default function CustomTable() {
  const columns = [{ key: 'searchKey', column: 'Value', required: true }];
  useGridView({ columns });
  return null;
}
