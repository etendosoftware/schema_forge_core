import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:conversion
const columns = [
  { key: 'toUOM', column: 'C_UOM_To_ID', type: 'selector', label: 'To UOM', required: true },
  { key: 'multipleRateBy', column: 'MultiplyRate', type: 'string', label: 'Multiple Rate By', required: true },
  { key: 'divideRateBy', column: 'DivideRate', type: 'string', label: 'Divide Rate By', required: true },
];
// @sf-generated-end columns:conversion

const filters = ['toUOM'];

// @sf-generated-start component:ConversionTable
const ConversionTable = forwardRef(function ConversionTable(props, ref) {
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

export default ConversionTable;
// @sf-generated-end component:ConversionTable
