import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:paymentPlan
const columns = [
  { key: 'dueDate', column: 'Duedate', type: 'date', label: 'Due Date', required: true },
  { key: 'expectedDate', column: 'ExpectedDate', type: 'date', label: 'Expected Date', required: true },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'selector', label: 'Payment Method', required: true },
  { key: 'amount', column: 'Amount', type: 'amount', label: 'Expected Amount', required: true },
  { key: 'paidAmount', column: 'Paidamt', type: 'amount', label: 'Paid Amount', required: true },
  { key: 'outstandingAmount', column: 'Outstandingamt', type: 'amount', label: 'Outstanding Amount', required: true },
];
// @sf-generated-end columns:paymentPlan

const filters = [];

// @sf-generated-start component:PaymentPlanTable
const PaymentPlanTable = forwardRef(function PaymentPlanTable(props, ref) {
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

export default PaymentPlanTable;
// @sf-generated-end component:PaymentPlanTable
