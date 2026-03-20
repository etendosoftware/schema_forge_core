import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentPlan
const fields = [
  { key: 'dueDate', column: 'Duedate', type: 'date', readOnly: true, section: 'other' },
  { key: 'expectedDate', column: 'ExpectedDate', type: 'date', section: 'principal' },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'selector', readOnly: true, section: 'other', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'amount', column: 'Amount', type: 'number', readOnly: true, section: 'other' },
  { key: 'paidAmount', column: 'Paidamt', type: 'number', readOnly: true, section: 'other' },
  { key: 'outstandingAmount', column: 'Outstandingamt', type: 'number', readOnly: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'lastPaymentDate', column: 'LastPaymentDate', type: 'date', readOnly: true, section: 'other' },
  { key: 'daysOverdue', column: 'daysOverDue', type: 'number', readOnly: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
];
// @sf-generated-end fields:paymentPlan

// @sf-generated-start component:PaymentPlanForm
export default function PaymentPlanForm(props) {
  // @sf-custom-slot hooks:PaymentPlanForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentPlanForm

// @sf-custom-slot section:PaymentPlanForm-custom
