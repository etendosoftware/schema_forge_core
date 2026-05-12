import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:productCharacteristic
const columns = [
  { key: 'sequenceNumber', column: 'Seqno', type: 'number', label: 'Sequence Number', required: true },
  { key: 'characteristic', column: 'M_Characteristic_ID', type: 'selector', label: 'Characteristic', required: true },
  { key: 'variant', column: 'Isvariant', type: 'boolean', label: 'Variant', required: true },
];
// @sf-generated-end columns:productCharacteristic

const filters = [];

// @sf-generated-start component:ProductCharacteristicTable
const ProductCharacteristicTable = forwardRef(function ProductCharacteristicTable(props, ref) {
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

export default ProductCharacteristicTable;
// @sf-generated-end component:ProductCharacteristicTable
