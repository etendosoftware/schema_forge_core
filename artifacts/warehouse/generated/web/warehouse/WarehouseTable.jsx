import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:warehouse
const columns = [
  { key: 'searchKey', column: 'Value', type: 'string', label: 'Search Key', required: true },
  { key: 'name', column: 'Name', type: 'string', label: 'Name', required: true },
];
// @sf-generated-end columns:warehouse

const filters = ['searchKey', 'name'];

// @sf-generated-start component:WarehouseTable
const WarehouseTable = forwardRef(function WarehouseTable(props, ref) {
  // Inline-editable layout owns rendering of the existing rows. The add-line flow keeps
  // using the proven DataTable inline-add row (callouts, focus management, defaults) —
  // when addRow.active flips on, we hand off to DataTable so the user can fill the new
  // line, then return to InlineLinesPanel once addRow.active flips off again. The ref
  // is forwarded so DetailView can imperatively flush pending edits on global save.
  if (props.linesLayout === 'inlineEditable' && !props.addRow?.active) {
    return <InlineLinesPanel ref={ref} columns={columns} {...props} />;
  }
  return <DataTable columns={columns} filters={filters} {...props} />;
});

export default WarehouseTable;
// @sf-generated-end component:WarehouseTable
