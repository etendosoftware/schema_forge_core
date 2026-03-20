import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentDetails
const fields = [
  { key: 'payment', column: 'FIN_Payment_ID', type: 'selector', label: 'Payment In', required: true, section: 'principal', reference: 'Payment', inputMode: 'selector' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', label: 'Payment Date', readOnly: true, section: 'other' },
  { key: 'dueDate', column: 'Duedate', type: 'date', label: 'Due Date', readOnly: true, section: 'other' },
  { key: 'expectedAmount', column: 'Expected', type: 'number', label: 'Expected Amount', readOnly: true, section: 'other' },
  { key: 'paidAmount', column: 'Paidamt', type: 'number', label: 'Received Amount', required: true, section: 'principal' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', label: 'Write-off Amount', section: 'principal' },
  { key: 'expectedAccountCurrency', column: 'ExpectedConverted', type: 'number', label: 'Expected (Account Currency)', readOnly: true, section: 'other' },
  { key: 'receivedAccountCurrency', column: 'PaidConverted', type: 'number', label: 'Received (Account Currency)', readOnly: true, section: 'other' },
  { key: 'exchangeRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', label: 'Exchange Rate', readOnly: true, section: 'other' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', label: 'Canceled', readOnly: true, section: 'other' },
  { key: 'status', column: 'Status', type: 'text', label: 'Status', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:paymentDetails

// @sf-generated-start component:PaymentDetailsForm
export default function PaymentDetailsForm(props) {
  // @sf-custom-slot hooks:PaymentDetailsForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentDetailsForm

// @sf-custom-slot section:PaymentDetailsForm-custom
