import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'transactionDate', column: 'TransactionDate', type: 'date', required: true },
  { key: 'description', column: 'Description', type: 'textarea', required: true },
  { key: 'amount', column: 'Amount', type: 'number', required: true },
  { key: 'matchedInvoice', column: 'C_Invoice_ID', type: 'search', reference: 'Invoice', inputMode: 'search' },
  { key: 'matchStatus', column: 'MatchStatus', type: 'text', required: true, readOnly: true },
];

export default function BankReconciliationLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
