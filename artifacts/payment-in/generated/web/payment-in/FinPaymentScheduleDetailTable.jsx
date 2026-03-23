import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:finPaymentScheduleDetail
const columns = [
  { key: 'dueDate', column: 'DueDate', type: 'date' },
  { key: 'invoiceAmount', column: 'InvoiceAmount', type: 'amount' },
  { key: 'expected', column: 'ExpectedAmount', type: 'amount' },
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'canceled', column: 'Iscanceled', type: 'boolean' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'string' },
];
// @sf-generated-end columns:finPaymentScheduleDetail

const filters = ['amount', 'canceled', 'businessPartner'];

// @sf-generated-start component:FinPaymentScheduleDetailTable
export default function FinPaymentScheduleDetailTable(props) {
  // @sf-custom-slot hooks:FinPaymentScheduleDetailTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:FinPaymentScheduleDetailTable

// @sf-custom-slot section:FinPaymentScheduleDetailTable-custom
