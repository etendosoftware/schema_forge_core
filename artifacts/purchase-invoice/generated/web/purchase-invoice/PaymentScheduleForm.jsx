import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentSchedule
const fields = [
  { key: 'dueDate', column: 'Duedate', type: 'date', required: true, readOnly: true },
  { key: 'expectedDate', column: 'ExpectedDate', type: 'date', required: true },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'selector', required: true, readOnly: true, reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'expectedAmount', column: 'Amount', type: 'number', required: true, readOnly: true },
  { key: 'paidAmount', column: 'Paidamt', type: 'number', required: true, readOnly: true },
  { key: 'outstandingAmount', column: 'Outstandingamt', type: 'number', required: true, readOnly: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'search', required: true, readOnly: true, reference: 'Currency' },
  { key: 'lastPaymentDate', column: 'LastPaymentDate', type: 'date', readOnly: true },
  { key: 'daysOverdue', column: 'daysOverDue', type: 'number', readOnly: true },
  { key: 'numberOfPayments', column: 'NumberOfPayments', type: 'number', readOnly: true },
  { key: 'description', column: 'Description', type: 'textarea' },
];
// @sf-generated-end fields:paymentSchedule

// @sf-generated-start component:PaymentScheduleForm
export default function PaymentScheduleForm(props) {
  // @sf-custom-slot hooks:PaymentScheduleForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentScheduleForm

// @sf-custom-slot section:PaymentScheduleForm-custom
