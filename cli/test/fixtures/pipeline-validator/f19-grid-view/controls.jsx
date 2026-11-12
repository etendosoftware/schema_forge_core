const COLS = [{ key: 'name', column: 'Name', type: 'string' }];
export default function CustomTable() {
  return <GridViewControls gridColumns={COLS} />;
}
