import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentDetails
const fields = [
  { key: 'paymentIn', column: 'FIN_Payment_ID', type: 'search', required: true, readOnly: true, section: 'other', reference: 'Payment', inputMode: 'search' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', readOnly: true, section: 'other' },
  { key: 'dueDate', column: 'Duedate', type: 'date', readOnly: true, section: 'other' },
  { key: 'paymentMethod', column: 'EM_APRM_Displayed_Paymmeth_ID', type: 'search', readOnly: true, section: 'other', reference: 'PaymentMethod', inputMode: 'search' },
  { key: 'financialAccount', column: 'EM_APRM_Displayed_Acc_ID', type: 'search', readOnly: true, section: 'other', reference: 'FinancialAccount', inputMode: 'search' },
  { key: 'expectedAmount', column: 'Expected', type: 'number', readOnly: true, section: 'other' },
  { key: 'receivedAmount', column: 'Paidamt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'writeOffAmount', column: 'Writeoffamt', type: 'number', readOnly: true, section: 'other' },
  { key: 'expectedAccountCurrency', column: 'ExpectedConverted', type: 'number', readOnly: true, section: 'other' },
  { key: 'receivedAccountCurrency', column: 'PaidConverted', type: 'number', readOnly: true, section: 'other' },
  { key: 'exchangeRate', column: 'Finacc_Txn_Convert_Rate', type: 'text', readOnly: true, section: 'other' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', readOnly: true, section: 'other' },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:paymentDetails

// @sf-generated-start component:PaymentDetailsForm
export default function PaymentDetailsForm(props) {
  // @sf-custom-slot hooks:PaymentDetailsForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentDetailsForm

// @sf-custom-slot section:PaymentDetailsForm-custom
