import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'bankAccount', label: 'Bank Account', type: 'selector', required: true, reference: 'BankAccount', inputMode: 'selector' },
  { key: 'statementDate', label: 'Statement Date', type: 'date', required: true },
  { key: 'endingBalance', label: 'Ending Balance', type: 'number', required: true },
];

export default function BankReconciliationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
