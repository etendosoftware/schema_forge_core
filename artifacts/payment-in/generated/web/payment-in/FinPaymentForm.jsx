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
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'search', label: 'Payment Method', required: true, section: 'other', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'amount', column: 'Amount', type: 'number', label: 'Amount', required: true, section: 'other' },
  // @sf-custom-slot callout:SE_Payment_FinAccount
  { key: 'account', column: 'Fin_Financial_Account_ID', type: 'dependent', label: 'Deposit To', required: true, section: 'other', inputMode: 'dependent', dependsOn: { field: 'paymentMethod', filterKey: 'Fin_Paymentmethod_ID' } },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'currency', column: 'C_Currency_ID', type: 'dependent', label: 'Currency', required: true, section: 'other', inputMode: 'dependent', dependsOn: { field: 'account', filterKey: 'FIN_Financial_Account_ID' } },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'financialTransactionAmount', column: 'Finacc_Txn_Amount', type: 'number', label: 'Received (Financial Account)', required: true, section: 'other' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'financialTransactionConvertRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', label: 'Exchange Rate', required: true, section: 'other' },
  { key: 'aPRMAddScheduledpayments', column: 'EM_Aprm_Add_Scheduledpayments', type: 'text', label: 'Add Details', section: 'other' },
  { key: 'aPRMProcessPayment', column: 'EM_APRM_Process_Payment', type: 'text', label: 'Payment Process', section: 'other' },
  { key: 'aprmExecutepayment', column: 'EM_Aprm_Executepayment', type: 'text', label: 'Execute Payment', section: 'other' },
  { key: 'status', column: 'Status', type: 'text', label: 'Status', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'generatedCredit', column: 'Generated_Credit', type: 'number', label: 'Generated Credit', readOnly: true, section: 'other' },
  { key: 'usedCredit', column: 'Used_Credit', type: 'number', label: 'Used Credit', readOnly: true, section: 'other' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', label: 'Write-off Amount', required: true, readOnly: true, section: 'other' },
  { key: 'reversedPayment', column: 'FIN_Rev_Payment_ID', type: 'search', label: 'Reversed Payment', readOnly: true, section: 'other', reference: 'Payment Selector', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', label: 'Project', section: 'other', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', label: 'Cost Center', section: 'other', reference: 'Cost Center Selector', inputMode: 'search' },
  { key: 'stDimension', column: 'User1_ID', type: 'search', label: '1st Dimension', section: 'other', reference: 'User Dimension 1', inputMode: 'search' },
  { key: 'ndDimension', column: 'User2_ID', type: 'search', label: '2nd Dimension', section: 'other', reference: 'User Dimension 2', inputMode: 'search' },
];
// @sf-generated-end fields:finPayment

// @sf-generated-start component:FinPaymentForm
export default function FinPaymentForm(props) {
  // @sf-custom-slot hooks:FinPaymentForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentForm

// @sf-custom-slot section:FinPaymentForm-custom
