// Grid-view list identified by its sourceIndex signature: required here = non-hideable.
const gridColumns = [
  { key: 'name', column: 'Name', sourceIndex: 0, type: 'string' },
  { key: 'searchKey', column: 'Value', sourceIndex: 1, type: 'string' },
];
export default function CustomTable() { return gridColumns.length; }
