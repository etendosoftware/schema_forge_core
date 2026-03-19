import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPaymentSchedule
const fields = [
  { key: 'duedate', column: 'Duedate', type: 'date', required: true, readOnly: true, section: 'other' },
  { key: 'expectedDate', column: 'ExpectedDate', type: 'date', required: true, section: 'principal' },
  { key: 'finPaymentmethodId', column: 'Fin_Paymentmethod_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Paymentmethod', inputMode: 'selector' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'paidamt', column: 'Paidamt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'outstandingamt', column: 'Outstandingamt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'cCurrencyId', column: 'C_Currency_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'lastPaymentDate', column: 'LastPaymentDate', type: 'date', readOnly: true, section: 'other' },
  { key: 'daysOverDue', column: 'daysOverDue', type: 'number', readOnly: true, section: 'other' },
  { key: 'numberOfPayments', column: 'NumberOfPayments', type: 'number', readOnly: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
];
// @sf-generated-end fields:finPaymentSchedule

// @sf-generated-start component:FinPaymentScheduleForm
export default function FinPaymentScheduleForm(props) {
  // @sf-custom-slot hooks:FinPaymentScheduleForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentScheduleForm

// @sf-custom-slot section:FinPaymentScheduleForm-custom
