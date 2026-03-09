import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'bankAccount', label: 'Bank Account', type: 'string' },
  { key: 'statementDate', label: 'Statement Date', type: 'date' },
  { key: 'endingBalance', label: 'Ending Balance', type: 'amount' },
  { key: 'difference', label: 'Difference', type: 'amount' },
  { key: 'status', label: 'Status', type: 'status' },
];

const filters = ['documentNo', 'bankAccount', 'statementDate'];

export default function BankReconciliationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
