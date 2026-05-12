import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:billOfMaterials
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', required: true },
  { key: 'bOMProduct', column: 'M_ProductBOM_ID', type: 'selector', label: 'BOM Product', required: true },
  { key: 'bOMQuantity', column: 'BOMQty', type: 'number', label: 'BOM Quantity', required: true },
];
// @sf-generated-end columns:billOfMaterials

const filters = [];

// @sf-generated-start component:BillOfMaterialsTable
const BillOfMaterialsTable = forwardRef(function BillOfMaterialsTable(props, ref) {
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

export default BillOfMaterialsTable;
// @sf-generated-end component:BillOfMaterialsTable
