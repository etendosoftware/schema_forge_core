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

export default ProductCharacteristicTable;
// @sf-generated-end component:ProductCharacteristicTable
