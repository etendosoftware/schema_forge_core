import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPayment
const fields = [
  // @sf-custom-slot callout:SL_AdvPayment_Document
  { key: 'documentType', column: 'C_DocType_ID', type: 'selector', required: true, section: 'principal', reference: 'DocumentType', inputMode: 'selector' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'principal' },
  { key: 'referenceNo', column: 'Referenceno', type: 'text', section: 'other' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', section: 'principal' },
  // @sf-custom-slot callout:SE_Payment_BPartner
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', section: 'principal', reference: 'BusinessPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  // @sf-custom-slot callout:SE_PaymentMethod_FinAccount
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'selector', required: true, section: 'principal', reference: 'PaymentMethod', inputMode: 'selector' },
  // @sf-custom-slot callout:SE_Payment_FinAccount
  { key: 'account', column: 'Fin_Financial_Account_ID', type: 'selector', required: true, section: 'principal', reference: 'FinancialAccount', inputMode: 'selector' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'financialTransactionAmount', column: 'Finacc_Txn_Amount', type: 'number', required: true, section: 'other' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'financialTransactionConvertRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', required: true, section: 'other' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'generatedCredit', column: 'Generated_Credit', type: 'number', section: 'other' },
  { key: 'aPRMAddScheduledpayments', column: 'EM_Aprm_Add_Scheduledpayments', type: 'text', section: 'other' },
  { key: 'aPRMProcessPayment', column: 'EM_APRM_Process_Payment', type: 'text', section: 'other' },
  { key: 'aprmExecutepayment', column: 'EM_Aprm_Executepayment', type: 'text', section: 'other' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'amount', column: 'Amount', type: 'number', required: true, readOnly: true, section: 'principal' },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true, section: 'principal' },
  { key: 'usedCredit', column: 'Used_Credit', type: 'number', readOnly: true, section: 'other' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'reversedPayment', column: 'FIN_Rev_Payment_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Payment', inputMode: 'selector' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'CostCenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'UserDimension1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'UserDimension2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
];
// @sf-generated-end fields:finPayment

// @sf-generated-start component:FinPaymentForm
export default function FinPaymentForm(props) {
  // @sf-custom-slot hooks:FinPaymentForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentForm

// @sf-custom-slot section:FinPaymentForm-custom
