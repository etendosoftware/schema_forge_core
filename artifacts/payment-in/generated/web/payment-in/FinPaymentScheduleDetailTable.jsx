import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:finPaymentScheduleDetail
const columns = [
  { key: 'dueDate', column: 'DueDate', type: 'date', label: 'Due Date' },
  { key: 'amount', column: 'Amount', type: 'amount', label: 'Received Amount', required: true },
  { key: 'invoicePaymentSchedule', column: 'FIN_Payment_Schedule_Invoice', type: 'selector', label: 'Invoice Payment Schedule' },
];
// @sf-generated-end columns:finPaymentScheduleDetail

const filters = [];

// @sf-generated-start component:FinPaymentScheduleDetailTable
const FinPaymentScheduleDetailTable = forwardRef(function FinPaymentScheduleDetailTable(props, ref) {
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

export default FinPaymentScheduleDetailTable;
// @sf-generated-end component:FinPaymentScheduleDetailTable
