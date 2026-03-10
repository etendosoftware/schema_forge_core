import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'bankAccount', column: 'C_BankAccount_ID', type: 'selector', required: true, reference: 'BankAccount', inputMode: 'selector' },
  { key: 'statementDate', column: 'StatementDate', type: 'date', required: true },
  { key: 'startingBalance', column: 'StartingBalance', type: 'number', required: true, readOnly: true },
  { key: 'endingBalance', column: 'EndingBalance', type: 'number', required: true },
  { key: 'difference', column: 'Difference', type: 'number', required: true, readOnly: true },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true },
];

export default function BankReconciliationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
