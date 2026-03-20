import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPayment
const fields = [
  { key: 'referenceNo', column: 'Referenceno', type: 'text', label: 'Reference No.', section: 'principal' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', label: 'Payment Date', section: 'principal' },
  // @sf-custom-slot callout:SE_Payment_BPartner
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', label: 'Received From', section: 'principal', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'principal' },
  // @sf-custom-slot callout:SE_PaymentMethod_FinAccount
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'search', label: 'Payment Method', required: true, section: 'principal', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'amount', column: 'Amount', type: 'number', label: 'Amount', required: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Payment_FinAccount
  { key: 'account', column: 'Fin_Financial_Account_ID', type: 'dependent', label: 'Deposit To', required: true, section: 'principal', inputMode: 'dependent', dependsOn: { field: 'paymentMethod', filterKey: 'Fin_Paymentmethod_ID' } },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'currency', column: 'C_Currency_ID', type: 'dependent', label: 'Currency', required: true, section: 'principal', inputMode: 'dependent', dependsOn: { field: 'account', filterKey: 'FIN_Financial_Account_ID' } },
  { key: 'status', column: 'Status', type: 'text', label: 'Status', required: true, readOnly: true, section: 'summary' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'generatedCredit', column: 'Generated_Credit', type: 'number', label: 'Generated Credit', readOnly: true, section: 'summary' },
  { key: 'usedCredit', column: 'Used_Credit', type: 'number', label: 'Used Credit', readOnly: true, section: 'summary' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', label: 'Write-off Amount', required: true, readOnly: true, section: 'summary' },
  { key: 'reversedPayment', column: 'FIN_Rev_Payment_ID', type: 'search', label: 'Reversed Payment', section: 'other', reference: 'Payment Selector', inputMode: 'search' },
];
// @sf-generated-end fields:finPayment

// @sf-generated-start component:FinPaymentForm
export default function FinPaymentForm(props) {
  // @sf-custom-slot hooks:FinPaymentForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentForm

// @sf-custom-slot section:FinPaymentForm-custom
