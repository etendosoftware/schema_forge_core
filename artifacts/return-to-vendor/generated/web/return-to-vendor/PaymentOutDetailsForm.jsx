import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentOutDetails
const fields = [
  { key: 'payment', column: 'FIN_Payment_ID', type: 'selector', label: 'Payment Out', required: true, section: 'principal', reference: 'Payment', inputMode: 'selector' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', label: 'Payment Date', section: 'principal' },
  { key: 'dueDate', column: 'Duedate', type: 'date', label: 'Due Date', section: 'principal' },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'search', label: 'Payment Method', section: 'principal', reference: 'Paymentmethod', inputMode: 'search' },
  { key: 'finFinancialAccountID', column: 'Fin_Financial_Account_ID', type: 'search', label: 'Financial Account', section: 'other', reference: 'Financial_Account', inputMode: 'search' },
  { key: 'expected', column: 'Expected', type: 'number', label: 'Expected Amount', section: 'other' },
  { key: 'paidAmount', column: 'Paidamt', type: 'number', label: 'Paid Amount', required: true, section: 'other' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', label: 'Write-off Amount', section: 'other' },
  { key: 'expectedConverted', column: 'ExpectedConverted', type: 'number', label: 'Expected (Account Currency)', section: 'other' },
  { key: 'paidConverted', column: 'PaidConverted', type: 'number', label: 'Paid (Account Currency)', section: 'other' },
  { key: 'finaccTxnConvertRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', label: 'Exchange Rate', section: 'other' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', label: 'Canceled', readOnly: true, section: 'other' },
  { key: 'status', column: 'Status', type: 'select', label: 'Status', required: true, readOnly: true, section: 'other', options: [{ value: 'RPAP', label: 'Awaiting Payment' }, { value: 'RPAE', label: 'Awaiting Execution' }, { value: 'RPVOID', label: 'Void' }, { value: 'PPM', label: 'Payment Made' }, { value: 'RPR', label: 'Payment Received' }, { value: 'RDNC', label: 'Deposited not Cleared' }, { value: 'PWNC', label: 'Withdrawn not Cleared' }, { value: 'RPPC', label: 'Payment Cleared' }] },
];
// @sf-generated-end fields:paymentOutDetails

// @sf-generated-start component:PaymentOutDetailsForm
export default function PaymentOutDetailsForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
PaymentOutDetailsForm.hasCollapsedFields = false;
// @sf-generated-end component:PaymentOutDetailsForm
