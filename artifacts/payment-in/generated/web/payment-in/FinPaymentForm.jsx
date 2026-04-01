import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPayment
const fields = [
  { key: 'referenceNo', column: 'Referenceno', type: 'text', label: 'Reference No.', readOnly: true, section: 'details' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', label: 'Payment Date', readOnly: true, section: 'principal', defaultValue: '@#Date@', readOnlyLogic: (record) => record['processed'] === true && record['status'] !== 'RPAE' },
  // @sf-custom-slot callout:SE_Payment_BPartner
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', label: 'Received From', readOnly: true, section: 'principal', reference: 'BPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'collapsed' },
  // @sf-custom-slot callout:SE_PaymentMethod_FinAccount
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'search', label: 'Payment Method', required: true, readOnly: true, section: 'principal', reference: 'Paymentmethod', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true && record['status'] !== 'RPAE' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'amount', column: 'Amount', type: 'number', label: 'Amount', required: true, readOnly: true, section: 'principal', defaultValue: '0', readOnlySource: 'server', readOnlyLogicReason: 'session-variable' },
  // @sf-custom-slot callout:SE_Payment_FinAccount
  { key: 'account', column: 'Fin_Financial_Account_ID', type: 'dependent', label: 'Deposit To', required: true, readOnly: true, section: 'principal', reference: 'Financial_Account', inputMode: 'dependent', dependsOn: { field: 'paymentMethod', filterKey: 'Fin_Paymentmethod_ID' }, readOnlyLogic: (record) => record['processed'] === true && record['status'] !== 'RPAE' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'currency', column: 'C_Currency_ID', type: 'dependent', label: 'Currency', required: true, readOnly: true, section: 'principal', reference: 'Currency', inputMode: 'dependent', dependsOn: { field: 'account', filterKey: 'FIN_Financial_Account_ID' }, readOnlySource: 'server', readOnlyLogicReason: 'session-variable' },
];
// @sf-generated-end fields:finPayment

// @sf-generated-start component:FinPaymentForm
export default function FinPaymentForm(props) {
  // @sf-custom-slot hooks:FinPaymentForm
  return <EntityForm fields={fields} cols={3} {...props} />;
}
// @sf-generated-end component:FinPaymentForm

// @sf-custom-slot section:FinPaymentForm-custom
