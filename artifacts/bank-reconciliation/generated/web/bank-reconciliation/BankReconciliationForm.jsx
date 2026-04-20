import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bankReconciliation
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'bankAccount', column: 'C_BankAccount_ID', type: 'selector', required: true, section: 'principal', reference: 'BankAccount', inputMode: 'selector' },
  { key: 'statementDate', column: 'StatementDate', type: 'date', required: true, section: 'principal' },
  { key: 'startingBalance', column: 'StartingBalance', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'endingBalance', column: 'EndingBalance', type: 'number', required: true, section: 'principal' },
  { key: 'difference', column: 'Difference', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:bankReconciliation

// @sf-generated-start component:BankReconciliationForm
export default function BankReconciliationForm(props) {
  // @sf-custom-slot hooks:BankReconciliationForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BankReconciliationForm

// @sf-custom-slot section:BankReconciliationForm-custom
