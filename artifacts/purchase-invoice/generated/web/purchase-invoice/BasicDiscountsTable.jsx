import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:basicDiscounts
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', required: true },
  { key: 'discount', column: 'C_Discount_ID', type: 'selector', label: 'Basic Discount', required: true },
  { key: 'cascade', column: 'Cascade', type: 'boolean', label: 'Cascade', required: true },
];
// @sf-generated-end columns:basicDiscounts

const filters = [];

// @sf-generated-start component:BasicDiscountsTable
const BasicDiscountsTable = forwardRef(function BasicDiscountsTable(props, ref) {
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

export default BasicDiscountsTable;
// @sf-generated-end component:BasicDiscountsTable
