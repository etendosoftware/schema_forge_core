import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentSchedule
const fields = [
  { key: 'dueDate', column: 'Duedate', type: 'date', required: true, readOnly: true, section: 'other' },
  { key: 'expectedDate', column: 'ExpectedDate', type: 'date', required: true, section: 'principal' },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'expectedAmount', column: 'Amount', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'paidAmount', column: 'Paidamt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'outstandingAmount', column: 'Outstandingamt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'search', required: true, readOnly: true, section: 'other', reference: 'Currency' },
  { key: 'lastPaymentDate', column: 'LastPaymentDate', type: 'date', readOnly: true, section: 'other' },
  { key: 'daysOverdue', column: 'daysOverDue', type: 'number', readOnly: true, section: 'other' },
  { key: 'numberOfPayments', column: 'NumberOfPayments', type: 'number', readOnly: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
];
// @sf-generated-end fields:paymentSchedule

// @sf-generated-start component:PaymentScheduleForm
export default function PaymentScheduleForm(props) {
  // @sf-custom-slot hooks:PaymentScheduleForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentScheduleForm

// @sf-custom-slot section:PaymentScheduleForm-custom
