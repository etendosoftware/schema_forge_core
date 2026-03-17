import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentDetails
const fields = [
  { key: 'paymentIn', column: 'FIN_Payment_ID', type: 'search', required: true, readOnly: true, reference: 'Payment', inputMode: 'search' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', readOnly: true },
  { key: 'dueDate', column: 'Duedate', type: 'date', readOnly: true },
  { key: 'paymentMethod', column: 'EM_APRM_Displayed_Paymmeth_ID', type: 'search', readOnly: true, reference: 'PaymentMethod', inputMode: 'search' },
  { key: 'financialAccount', column: 'EM_APRM_Displayed_Acc_ID', type: 'search', readOnly: true, reference: 'FinancialAccount', inputMode: 'search' },
  { key: 'expectedAmount', column: 'Expected', type: 'number', readOnly: true },
  { key: 'receivedAmount', column: 'Paidamt', type: 'number', required: true, readOnly: true },
  { key: 'writeOffAmount', column: 'Writeoffamt', type: 'number', readOnly: true },
  { key: 'expectedAccountCurrency', column: 'ExpectedConverted', type: 'number', readOnly: true },
  { key: 'receivedAccountCurrency', column: 'PaidConverted', type: 'number', readOnly: true },
  { key: 'exchangeRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', readOnly: true },
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
