import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentDetails
const fields = [
  { key: 'amount', column: 'Amount', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', readOnly: true, section: 'other' },
  { key: 'amount2', column: 'Amount', type: 'number', required: true, section: 'principal' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'finPaymentID', column: 'Fin_Payment_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Payment', inputMode: 'selector' },
  { key: 'invoicePaid', column: 'Isinvoicepaid', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:paymentDetails

// @sf-generated-start component:PaymentDetailsForm
export default function PaymentDetailsForm(props) {
  // @sf-custom-slot hooks:PaymentDetailsForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentDetailsForm

// @sf-custom-slot section:PaymentDetailsForm-custom
