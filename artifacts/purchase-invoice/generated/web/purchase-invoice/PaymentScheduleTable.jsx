import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:paymentSchedule
const columns = [
  { key: 'dueDate', column: 'Duedate', type: 'date' },
  { key: 'expectedDate', column: 'ExpectedDate', type: 'date' },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'string' },
  { key: 'expectedAmount', column: 'Amount', type: 'amount' },
  { key: 'paidAmount', column: 'Paidamt', type: 'amount' },
  { key: 'outstandingAmount', column: 'Outstandingamt', type: 'amount' },
  { key: 'daysOverdue', column: 'daysOverDue', type: 'number' },
];
// @sf-generated-end columns:paymentSchedule

const filters = [];

// @sf-generated-start component:PaymentScheduleTable
export default function PaymentScheduleTable(props) {
  // @sf-custom-slot hooks:PaymentScheduleTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:PaymentScheduleTable

// @sf-custom-slot section:PaymentScheduleTable-custom
