import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:usedCreditSource
const columns = [
  { key: 'creditPaymentUsed', column: 'FIN_Payment_Id_Used', type: 'selector', label: 'Credit Payment Used', required: true },
  { key: 'amount', column: 'Amount', type: 'number', label: 'Amount', required: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', label: 'Currency', required: true },
];
// @sf-generated-end columns:usedCreditSource

const filters = [];

// @sf-generated-start component:UsedCreditSourceTable
const UsedCreditSourceTable = forwardRef(function UsedCreditSourceTable(props, ref) {
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

export default UsedCreditSourceTable;
// @sf-generated-end component:UsedCreditSourceTable
