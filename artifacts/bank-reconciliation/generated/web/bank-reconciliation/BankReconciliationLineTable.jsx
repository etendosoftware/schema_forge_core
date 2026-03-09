import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'transactionDate', label: 'Transaction Date', type: 'date' },
  { key: 'description', label: 'Description', type: 'string' },
  { key: 'amount', label: 'Amount', type: 'amount' },
  { key: 'matchedInvoice', label: 'Matched Invoice', type: 'string' },
  { key: 'matchStatus', label: 'Match Status', type: 'status' },
];

const filters = ['description', 'transactionDate'];

export default function BankReconciliationLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
