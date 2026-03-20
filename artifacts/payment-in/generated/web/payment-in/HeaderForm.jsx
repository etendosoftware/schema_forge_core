import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:header
const fields = [
  { key: 'referenceNo', column: 'Referenceno', type: 'text', section: 'principal' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', section: 'principal' },
  // @sf-custom-slot callout:SE_Payment_BPartner
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', section: 'principal', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  // @sf-custom-slot callout:SE_PaymentMethod_FinAccount
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'search', required: true, section: 'other', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'other' },
  // @sf-custom-slot callout:SE_Payment_FinAccount
  { key: 'account', column: 'Fin_Financial_Account_ID', type: 'dependent', required: true, section: 'other', inputMode: 'dependent', dependsOn: { field: 'paymentMethod', filterKey: 'Fin_Paymentmethod_ID' } },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'currency', column: 'C_Currency_ID', type: 'dependent', required: true, section: 'other', inputMode: 'dependent', dependsOn: { field: 'account', filterKey: 'FIN_Financial_Account_ID' } },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'financialTransactionAmount', column: 'Finacc_Txn_Amount', type: 'number', required: true, section: 'other' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'financialTransactionConvertRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', required: true, section: 'other' },
  { key: 'aPRMAddScheduledpayments', column: 'EM_Aprm_Add_Scheduledpayments', type: 'text', section: 'other' },
  { key: 'aPRMProcessPayment', column: 'EM_APRM_Process_Payment', type: 'text', section: 'other' },
  { key: 'aprmExecutepayment', column: 'EM_Aprm_Executepayment', type: 'text', section: 'other' },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'generatedCredit', column: 'Generated_Credit', type: 'number', readOnly: true, section: 'other' },
  { key: 'usedCredit', column: 'Used_Credit', type: 'number', readOnly: true, section: 'other' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'reversedPayment', column: 'FIN_Rev_Payment_ID', type: 'search', readOnly: true, section: 'other', reference: 'Payment Selector', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', section: 'other', reference: 'Cost Center Selector', inputMode: 'search' },
  { key: 'stDimension', column: 'User1_ID', type: 'search', section: 'other', reference: 'User Dimension 1', inputMode: 'search' },
  { key: 'ndDimension', column: 'User2_ID', type: 'search', section: 'other', reference: 'User Dimension 2', inputMode: 'search' },
];
// @sf-generated-end fields:header

// @sf-generated-start component:HeaderForm
export default function HeaderForm(props) {
  // @sf-custom-slot hooks:HeaderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:HeaderForm

// @sf-custom-slot section:HeaderForm-custom
