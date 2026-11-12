export function GridPart() {
  const columns = [{ key: 'searchKey', column: 'Value', required: true }];
  useGridView({ columns });
  return null;
}
export default function CustomTable() {
  const columns = [{ key: 'name', column: 'Name' }];
  return <DataTable columns={columns} />;
}
