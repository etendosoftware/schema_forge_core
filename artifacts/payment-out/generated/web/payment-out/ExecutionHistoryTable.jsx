import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:executionHistory
const columns = [
  { key: 'executionDate', column: 'Executiondate', type: 'date', label: 'Execution Date' },
  { key: 'paymentRunStatus', column: 'Prun_Status', type: 'status', label: 'Payment Out Run Status', enumLabels: { 'E': 'Executed', 'PE': 'Partially Executed', 'P': 'Pending' } },
  { key: 'paymentExecutionResult', column: 'Paymentexec_Result', type: 'enum', label: 'Payment Out Execution Result', enumLabels: { 'E': 'Error', 'P': 'Pending', 'S': 'Successful' } },
  { key: 'paymentExecutionMessage', column: 'Paymentexec_Message', type: 'string', label: 'Payment Out Execution Message' },
];
// @sf-generated-end columns:executionHistory

const filters = [];

// @sf-generated-start component:ExecutionHistoryTable
const ExecutionHistoryTable = forwardRef(function ExecutionHistoryTable(props, ref) {
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

export default ExecutionHistoryTable;
// @sf-generated-end component:ExecutionHistoryTable
