import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentOutPlan
const fields = [
  { key: 'dueDate', column: 'Duedate', type: 'date', label: 'Due Date', section: 'principal' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'search', label: 'Payment Method', required: true, section: 'principal', reference: 'Paymentmethod', inputMode: 'search' },
  { key: 'expected', column: 'Expected', type: 'number', label: 'Expected Amount', required: true, section: 'principal' },
  { key: 'received', column: 'Received', type: 'number', label: 'Paid', required: true, section: 'principal' },
  { key: 'outstanding', column: 'Outstanding', type: 'number', label: 'Outstanding', required: true, section: 'other' },
  { key: 'lastPayment', column: 'Lastpayment', type: 'date', label: 'Last Payment Date', section: 'other' },
  { key: 'numberOfPayments', column: 'Numberofpayments', type: 'number', label: 'Number of Payments', section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'search', label: 'Currency', required: true, section: 'other', reference: 'Currency', inputMode: 'search' },
];
// @sf-generated-end fields:paymentOutPlan

// @sf-generated-start component:PaymentOutPlanForm
export default function PaymentOutPlanForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
PaymentOutPlanForm.hasCollapsedFields = false;
// @sf-generated-end component:PaymentOutPlanForm
