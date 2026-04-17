import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bankReconciliationLine
const fields = [
  { key: 'transactionDate', column: 'TransactionDate', type: 'date', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', required: true, section: 'principal' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'principal' },
  { key: 'matchedInvoice', column: 'C_Invoice_ID', type: 'search', section: 'principal', reference: 'Invoice', inputMode: 'search' },
  { key: 'matchStatus', column: 'MatchStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:bankReconciliationLine

// @sf-generated-start component:BankReconciliationLineForm
export default function BankReconciliationLineForm(props) {
  // @sf-custom-slot hooks:BankReconciliationLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BankReconciliationLineForm

// @sf-custom-slot section:BankReconciliationLineForm-custom
