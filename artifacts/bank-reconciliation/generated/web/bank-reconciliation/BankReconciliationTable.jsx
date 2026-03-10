import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'bankAccount', column: 'C_BankAccount_ID', type: 'string' },
  { key: 'statementDate', column: 'StatementDate', type: 'date' },
  { key: 'endingBalance', column: 'EndingBalance', type: 'amount' },
  { key: 'difference', column: 'Difference', type: 'amount' },
  { key: 'status', column: 'Status', type: 'status' },
];

const filters = ['documentNo', 'bankAccount', 'statementDate'];

export default function BankReconciliationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
