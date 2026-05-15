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
  // Inline-editable layout always uses InlineLinesPanel for existing rows so column
  // widths (flex layout) never shift when the add-row form opens. When addRow is
  // active we render a header-hidden, data-hidden DataTable below for just the
  // add-row form — it owns callouts, selectors, validation and the imperative flush
  // ref. The ref is forwarded to InlineLinesPanel so DetailView can flush pending
  // inline edits on global save.
  if (props.linesLayout === 'inlineEditable') {
    if (props.addRow?.active) {
      return (
        <>
          <InlineLinesPanel ref={ref} columns={columns} {...props} addRow={undefined} />
          <DataTable columns={columns} filters={filters} {...props} hideHeader hideDataRows />
        </>
      );
    }
    return <InlineLinesPanel ref={ref} columns={columns} {...props} />;
  }
  return <DataTable columns={columns} filters={filters} {...props} />;
});

export default BillOfMaterialsTable;
// @sf-generated-end component:BillOfMaterialsTable
