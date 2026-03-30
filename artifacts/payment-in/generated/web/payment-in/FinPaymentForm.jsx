import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPayment
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'principal' },
  { key: 'referenceNo', column: 'Referenceno', type: 'text', section: 'collapsed' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', section: 'principal', defaultValue: '@#Date@' },
  // @sf-custom-slot callout:SE_Payment_BPartner
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', section: 'principal', reference: 'BPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'collapsed' },
  // @sf-custom-slot callout:SE_PaymentMethod_FinAccount
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'search', required: true, section: 'collapsed', reference: 'Paymentmethod', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'principal', defaultValue: '0' },
  // @sf-custom-slot callout:SE_Payment_FinAccount
  { key: 'account', column: 'Fin_Financial_Account_ID', type: 'dependent', required: true, section: 'collapsed', reference: 'Financial_Account', inputMode: 'dependent', dependsOn: { field: 'paymentMethod', filterKey: 'Fin_Paymentmethod_ID' } },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'currency', column: 'C_Currency_ID', type: 'dependent', required: true, section: 'collapsed', reference: 'Currency', inputMode: 'dependent', dependsOn: { field: 'account', filterKey: 'FIN_Financial_Account_ID' } },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'generatedCredit', column: 'Generated_Credit', type: 'number', readOnly: true, section: 'summary', defaultValue: '0' },
  { key: 'usedCredit', column: 'Used_Credit', type: 'number', readOnly: true, section: 'summary', defaultValue: '0' },
];
// @sf-generated-end fields:finPayment

// @sf-generated-start component:FinPaymentForm
export default function FinPaymentForm(props) {
  // @sf-custom-slot hooks:FinPaymentForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentForm

// @sf-custom-slot section:FinPaymentForm-custom
