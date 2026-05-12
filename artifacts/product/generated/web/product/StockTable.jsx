import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:stock
const columns = [
  { key: 'storageBin', column: 'M_Locator_ID', type: 'selector', label: 'Storage Bin', required: true },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'string', label: 'Attribute Set Value' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM', required: true },
  { key: 'quantityOnHand', column: 'QtyOnHand', type: 'number', label: 'Quantity on Hand', required: true },
  { key: 'reservedQty', column: 'ReservedQty', type: 'number', label: 'Reserved Qty', required: true },
  { key: 'allocatedQuantity', column: 'AllocatedQty', type: 'number', label: 'Allocated Quantity', required: true },
];
// @sf-generated-end columns:stock

const filters = [];

// @sf-generated-start component:StockTable
const StockTable = forwardRef(function StockTable(props, ref) {
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

export default StockTable;
// @sf-generated-end component:StockTable
