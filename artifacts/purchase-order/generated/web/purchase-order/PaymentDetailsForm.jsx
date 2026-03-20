import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentDetails
const fields = [
  { key: 'payment', column: 'FIN_Payment_ID', type: 'search', label: 'Payment Out', required: true, readOnly: true, section: 'other', reference: 'Payment' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', label: 'Payment Date', readOnly: true, section: 'other' },
  { key: 'dueDate', column: 'Duedate', type: 'date', label: 'Due Date', readOnly: true, section: 'other' },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'search', label: 'Payment Method', readOnly: true, section: 'other', reference: 'PaymentMethod' },
  { key: 'finFinancialAccountID', column: 'Fin_Financial_Account_ID', type: 'search', label: 'Financial Account', readOnly: true, section: 'other', reference: 'FinancialAccount' },
  { key: 'expected', column: 'Expected', type: 'number', label: 'Expected Amount', readOnly: true, section: 'other' },
  { key: 'paidAmount', column: 'Paidamt', type: 'number', label: 'Paid Amount', required: true, readOnly: true, section: 'other' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', label: 'Write-off Amount', readOnly: true, section: 'other' },
  { key: 'expectedConverted', column: 'ExpectedConverted', type: 'number', label: 'Expected (Account Currency)', readOnly: true, section: 'other' },
  { key: 'paidConverted', column: 'PaidConverted', type: 'number', label: 'Paid (Account Currency)', readOnly: true, section: 'other' },
  { key: 'finaccTxnConvertRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', label: 'Exchange Rate', readOnly: true, section: 'other' },
  { key: 'paymentno', column: 'Paymentno', type: 'text', label: 'Payment No.', required: true, readOnly: true, section: 'other' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', label: 'Canceled', readOnly: true, section: 'other' },
  { key: 'status', column: 'Status', type: 'text', label: 'Status', required: true, readOnly: true, section: 'other' },
  { key: 'invoiceno', column: 'Invoiceno', type: 'text', label: 'Invoice No.', readOnly: true, section: 'other' },
  { key: 'invoiceAmount', column: 'Invoicedamt', type: 'number', label: 'Invoice Amount', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:paymentDetails

// @sf-generated-start component:PaymentDetailsForm
export default function PaymentDetailsForm(props) {
  // @sf-custom-slot hooks:PaymentDetailsForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentDetailsForm

// @sf-custom-slot section:PaymentDetailsForm-custom
