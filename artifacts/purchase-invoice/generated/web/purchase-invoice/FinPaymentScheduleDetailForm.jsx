import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPaymentScheduleDetail
const fields = [
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'principal' },
  { key: 'writeoffamt', column: 'Writeoffamt', type: 'number', section: 'principal' },
  // @sf-custom-slot callout:SE_Payment_MultiCurrency
  { key: 'paymentdate', column: 'Paymentdate', type: 'date', section: 'principal' },
  // @sf-custom-slot callout:SE_PaymentMethod_FinAccount
  { key: 'finPaymentmethodId', column: 'Fin_Paymentmethod_ID', type: 'selector', required: true, section: 'principal', reference: 'Paymentmethod', inputMode: 'selector' },
  { key: 'amount2', column: 'Amount', type: 'number', required: true, section: 'other' },
  // @sf-custom-slot callout:SE_Payment_FinAccount
  { key: 'finFinancialAccountId', column: 'Fin_Financial_Account_ID', type: 'selector', required: true, section: 'other', reference: 'Financial_Account', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'text', required: true, section: 'other' },
  { key: 'iscanceled', column: 'Iscanceled', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'finPaymentId', column: 'Fin_Payment_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Payment', inputMode: 'selector' },
  { key: 'isinvoicepaid', column: 'Isinvoicepaid', type: 'checkbox', required: true, section: 'other' },
];
// @sf-generated-end fields:finPaymentScheduleDetail

// @sf-generated-start component:FinPaymentScheduleDetailForm
export default function FinPaymentScheduleDetailForm(props) {
  // @sf-custom-slot hooks:FinPaymentScheduleDetailForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentScheduleDetailForm

// @sf-custom-slot section:FinPaymentScheduleDetailForm-custom
