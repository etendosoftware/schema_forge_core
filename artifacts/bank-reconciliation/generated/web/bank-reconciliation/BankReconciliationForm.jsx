import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', label: 'Document No', type: 'text', required: true, readOnly: true },
  { key: 'bankAccount', label: 'Bank Account', type: 'selector', required: true, reference: 'BankAccount', inputMode: 'selector' },
  { key: 'statementDate', label: 'Statement Date', type: 'date', required: true },
  { key: 'startingBalance', label: 'Starting Balance', type: 'number', required: true, readOnly: true },
  { key: 'endingBalance', label: 'Ending Balance', type: 'number', required: true },
  { key: 'difference', label: 'Difference', type: 'number', required: true, readOnly: true },
  { key: 'status', label: 'Status', type: 'text', required: true, readOnly: true },
];

export default function BankReconciliationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
