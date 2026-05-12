import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:costing
const columns = [
  { key: 'costType', column: 'Costtype', type: 'enum', label: 'Cost Type', enumLabels: { 'AVA': 'Average', 'STA': 'Standard' }, required: true },
  { key: 'cost', column: 'Cost', type: 'number', label: 'Cost' },
  { key: 'startingDate', column: 'DateFrom', type: 'date', label: 'Starting Date', required: true },
  { key: 'endingDate', column: 'DateTo', type: 'date', label: 'Ending Date', required: true },
  { key: 'quantity', column: 'Qty', type: 'number', label: 'Quantity' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', label: 'Warehouse' },
];
// @sf-generated-end columns:costing

const filters = [];

// @sf-generated-start component:CostingTable
const CostingTable = forwardRef(function CostingTable(props, ref) {
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

export default CostingTable;
// @sf-generated-end component:CostingTable
