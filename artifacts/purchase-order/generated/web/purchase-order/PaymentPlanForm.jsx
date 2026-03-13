import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentPlan
const fields = [
  { key: 'dueDate', column: 'Duedate', type: 'date', readOnly: true },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'search', required: true, readOnly: true, reference: 'PaymentMethod' },
  { key: 'expected', column: 'Expected', type: 'number', required: true, readOnly: true },
  { key: 'received', column: 'Received', type: 'number', required: true, readOnly: true },
  { key: 'outstanding', column: 'Outstanding', type: 'number', required: true, readOnly: true },
  { key: 'lastPayment', column: 'Lastpayment', type: 'date', readOnly: true },
  { key: 'numberOfPayments', column: 'Numberofpayments', type: 'number', readOnly: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'search', required: true, readOnly: true, reference: 'Currency' },
];
// @sf-generated-end fields:paymentPlan

// @sf-generated-start component:PaymentPlanForm
export default function PaymentPlanForm(props) {
  // @sf-custom-slot hooks:PaymentPlanForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentPlanForm

// @sf-custom-slot section:PaymentPlanForm-custom
