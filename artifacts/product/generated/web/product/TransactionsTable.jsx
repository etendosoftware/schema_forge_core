import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:transactions
const columns = [
  { key: 'organization', column: 'AD_Org_ID', type: 'selector', label: 'Organization', required: true },
  { key: 'storageBin', column: 'M_Locator_ID', type: 'selector', label: 'Storage Bin', required: true },
  { key: 'movementQuantity', column: 'MovementQty', type: 'number', label: 'Movement Quantity', required: true },
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date', required: true },
  { key: 'movementType', column: 'MovementType', type: 'enum', label: 'Movement Type', enumLabels: { 'V+': 'Vendor Receipts', 'I+': 'Inventory In', 'M-': 'Movement From', 'M+': 'Movement To', 'I-': 'Inventory Out', 'P-': 'Production -', 'P+': 'Production +', 'C-': 'Customer Shipment', 'D-': 'Internal Consumption -', 'D+': 'Internal Consumption +' }, required: true },
  { key: 'totalCost', column: 'TotalCost', type: 'amount', label: 'Total Cost' },
];
// @sf-generated-end columns:transactions

const filters = [];

// @sf-generated-start component:TransactionsTable
const TransactionsTable = forwardRef(function TransactionsTable(props, ref) {
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

export default TransactionsTable;
// @sf-generated-end component:TransactionsTable
