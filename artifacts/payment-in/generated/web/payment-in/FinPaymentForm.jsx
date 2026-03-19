import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPayment
const fields = [
  { key: 'referenceNo', column: 'Referenceno', type: 'text', section: 'principal', inputMode: 'text' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', section: 'principal', inputMode: 'date' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', section: 'principal', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal', inputMode: 'text' },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'search', required: true, section: 'other', inputMode: 'search' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'other', inputMode: 'number' },
  { key: 'account', column: 'Fin_Financial_Account_ID', type: 'search', required: true, section: 'other', inputMode: 'search' },
  { key: 'currency', column: 'C_Currency_ID', type: 'search', required: true, section: 'other', inputMode: 'search' },
  { key: 'financialTransactionAmount', column: 'Finacc_Txn_Amount', type: 'number', required: true, section: 'other', inputMode: 'number' },
  { key: 'financialTransactionConvertRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', required: true, section: 'other', inputMode: 'text' },
  { key: 'aPRMAddScheduledpayments', column: 'EM_Aprm_Add_Scheduledpayments', type: 'text', section: 'other', inputMode: 'text' },
  { key: 'aPRMProcessPayment', column: 'EM_APRM_Process_Payment', type: 'text', section: 'other', inputMode: 'text' },
  { key: 'aprmExecutepayment', column: 'EM_Aprm_Executepayment', type: 'text', section: 'other', inputMode: 'text' },
  { key: 'reversedPayment', column: 'FIN_Rev_Payment_ID', type: 'search', readOnly: true, section: 'other', reference: 'Payment Selector', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', section: 'other', reference: 'Cost Center Selector', inputMode: 'search' },
  { key: 'stDimension', column: 'User1_ID', type: 'search', section: 'other', reference: 'User Dimension 1', inputMode: 'search' },
  { key: 'ndDimension', column: 'User2_ID', type: 'search', section: 'other', reference: 'User Dimension 2', inputMode: 'search' },
];
// @sf-generated-end fields:finPayment

// @sf-generated-start component:FinPaymentForm
export default function FinPaymentForm(props) {
  // @sf-custom-slot hooks:FinPaymentForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentForm

// @sf-custom-slot section:FinPaymentForm-custom
