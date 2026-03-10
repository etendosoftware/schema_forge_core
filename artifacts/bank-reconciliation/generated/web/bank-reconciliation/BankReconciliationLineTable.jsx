import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'transactionDate', column: 'TransactionDate', type: 'date' },
  { key: 'description', column: 'Description', type: 'string' },
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'matchedInvoice', column: 'C_Invoice_ID', type: 'string' },
  { key: 'matchStatus', column: 'MatchStatus', type: 'status' },
];

const filters = ['description', 'transactionDate'];

export default function BankReconciliationLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
