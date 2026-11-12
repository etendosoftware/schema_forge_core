// Four bindings deep: beyond the two-hop limit, so the source list is still checked.
const BASE = [{ key: 'name', column: 'Name', type: 'string' }];
const a = BASE.map(c => c);
const b = a.map(c => c);
const c3 = b.map(c => c);
export default function CustomTable() {
  useGridView({ columns: c3 });
  return null;
}
