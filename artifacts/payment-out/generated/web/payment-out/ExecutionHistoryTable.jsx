import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:executionHistory
const columns = [
  { key: 'executionDate', column: 'Executiondate', type: 'date' },
  { key: 'paymentRunStatus', column: 'Prun_Status', type: 'status' },
  { key: 'paymentExecutionResult', column: 'Paymentexec_Result', type: 'string' },
  { key: 'paymentExecutionMessage', column: 'Paymentexec_Message', type: 'string' },
];
// @sf-generated-end columns:executionHistory

const filters = [];

// @sf-generated-start component:ExecutionHistoryTable
export default function ExecutionHistoryTable(props) {
  // @sf-custom-slot hooks:ExecutionHistoryTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ExecutionHistoryTable

// @sf-custom-slot section:ExecutionHistoryTable-custom
