import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:finPaymentScheduleDetail
const columns = [
  { key: 'dueDate', column: 'DueDate', type: 'date' },
  { key: 'invoiceAmount', column: 'InvoiceAmount', type: 'amount' },
  { key: 'expected', column: 'ExpectedAmount', type: 'amount' },
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'orderPaymentSchedule', column: 'FIN_Payment_Schedule_Order', type: 'string' },
  { key: 'invoicePaymentSchedule', column: 'FIN_Payment_Schedule_Invoice', type: 'string' },
  { key: 'gLItem', column: 'C_Glitem_ID', type: 'string' },
  { key: 'canceled', column: 'Iscanceled', type: 'boolean' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'string' },
  { key: 'activity', column: 'C_Activity_ID', type: 'string' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'salesCampaign', column: 'C_Campaign_ID', type: 'string' },
  { key: 'project', column: 'C_Project_ID', type: 'string' },
  { key: 'salesRegion', column: 'C_Salesregion_ID', type: 'string' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'string' },
  { key: 'stDimension', column: 'User1_ID', type: 'string' },
  { key: 'ndDimension', column: 'User2_ID', type: 'string' },
];
// @sf-generated-end columns:finPaymentScheduleDetail

const filters = ['amount', 'orderPaymentSchedule', 'invoicePaymentSchedule', 'gLItem', 'canceled', 'businessPartner', 'activity', 'product', 'salesCampaign', 'project', 'salesRegion', 'costCenter', 'stDimension', 'ndDimension'];

// @sf-generated-start component:FinPaymentScheduleDetailTable
export default function FinPaymentScheduleDetailTable(props) {
  // @sf-custom-slot hooks:FinPaymentScheduleDetailTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:FinPaymentScheduleDetailTable

// @sf-custom-slot section:FinPaymentScheduleDetailTable-custom
