import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentDetails
const fields = [
  { key: 'payment', column: 'FIN_Payment_ID', type: 'search', required: true, readOnly: true, reference: 'Payment' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', readOnly: true },
  { key: 'dueDate', column: 'Duedate', type: 'date', readOnly: true },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'search', readOnly: true, reference: 'PaymentMethod' },
  { key: 'finFinancialAccountID', column: 'Fin_Financial_Account_ID', type: 'search', readOnly: true, reference: 'FinancialAccount' },
  { key: 'expected', column: 'Expected', type: 'number', readOnly: true },
  { key: 'paidAmount', column: 'Paidamt', type: 'number', required: true, readOnly: true },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', readOnly: true },
  { key: 'expectedConverted', column: 'ExpectedConverted', type: 'number', readOnly: true },
  { key: 'paidConverted', column: 'PaidConverted', type: 'number', readOnly: true },
  { key: 'finaccTxnConvertRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', readOnly: true },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', readOnly: true },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true },
];
// @sf-generated-end fields:paymentDetails

// @sf-generated-start component:PaymentDetailsForm
export default function PaymentDetailsForm(props) {
  // @sf-custom-slot hooks:PaymentDetailsForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentDetailsForm

// @sf-custom-slot section:PaymentDetailsForm-custom
