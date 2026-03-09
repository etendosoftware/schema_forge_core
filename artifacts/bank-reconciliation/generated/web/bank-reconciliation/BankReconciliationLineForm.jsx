import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'transactionDate', label: 'Transaction Date', type: 'date', required: true },
  { key: 'description', label: 'Description', type: 'textarea', required: true },
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'matchedInvoice', label: 'Matched Invoice', type: 'search', reference: 'Invoice', inputMode: 'search' },
  { key: 'matchStatus', label: 'Match Status', type: 'text', required: true, readOnly: true },
];

export default function BankReconciliationLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
