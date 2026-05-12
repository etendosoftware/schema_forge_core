import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:assignedProducts
const columns = [
  { key: 'searchKey', column: 'Value', type: 'string', label: 'Search Key', required: true },
  { key: 'name', column: 'Name', type: 'string', label: 'Name', required: true },
  { key: 'productType', column: 'ProductType', type: 'enum', label: 'Product Type', enumLabels: { 'E': 'Expense type', 'I': 'Item', 'R': 'Resource', 'S': 'Service' }, required: true },
];
// @sf-generated-end columns:assignedProducts

const filters = ['searchKey', 'name', 'productType'];

// @sf-generated-start component:AssignedProductsTable
const AssignedProductsTable = forwardRef(function AssignedProductsTable(props, ref) {
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

export default AssignedProductsTable;
// @sf-generated-end component:AssignedProductsTable
