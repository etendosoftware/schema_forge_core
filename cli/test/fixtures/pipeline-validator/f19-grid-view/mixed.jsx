// Grid-view list (skipped) and a genuine list (must still be reported) in one file.
const GRID = [{ key: 'searchKey', column: 'Value', required: true, type: 'string' }];
const columns = [{ key: 'name', column: 'Name', type: 'string' }];
export default function CustomTable() {
  useGridView({ columns: GRID });
  return <DataTable columns={columns} />;
}
