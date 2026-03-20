import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPaymentScheduleDetail
const fields = [
  { key: 'dueDate', column: 'DueDate', type: 'date', label: 'Due Date', readOnly: true, section: 'other' },
  { key: 'invoiceAmount', column: 'InvoiceAmount', type: 'number', label: 'Invoice Amount', readOnly: true, section: 'other' },
  { key: 'expected', column: 'ExpectedAmount', type: 'number', label: 'Expected Amount', readOnly: true, section: 'other' },
  { key: 'amount', column: 'Amount', type: 'number', label: 'Received Amount', required: true, section: 'principal' },
  { key: 'orderPaymentSchedule', column: 'FIN_Payment_Schedule_Order', type: 'search', label: 'Order Payment Schedule', section: 'principal', inputMode: 'search' },
  { key: 'invoicePaymentSchedule', column: 'FIN_Payment_Schedule_Invoice', type: 'search', label: 'Invoice Payment Schedule', section: 'principal', inputMode: 'search' },
  { key: 'gLItem', column: 'C_Glitem_ID', type: 'search', label: 'G/L Item', section: 'principal', inputMode: 'search' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', label: 'Canceled', required: true, section: 'other' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', label: 'Business Partner', section: 'other', inputMode: 'search' },
  { key: 'activity', column: 'C_Activity_ID', type: 'search', label: 'Activity', section: 'other', reference: 'Activity selector', inputMode: 'search' },
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', section: 'other', inputMode: 'search' },
  { key: 'salesCampaign', column: 'C_Campaign_ID', type: 'search', label: 'Sales Campaign', section: 'other', reference: 'Campaign selector', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', label: 'Project', section: 'other', inputMode: 'search' },
  { key: 'salesRegion', column: 'C_Salesregion_ID', type: 'search', label: 'Sales Region', section: 'other', reference: 'Sales region selector', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', label: 'Cost Center', section: 'other', reference: 'Cost Center Selector', inputMode: 'search' },
  { key: 'stDimension', column: 'User1_ID', type: 'search', label: '1st Dimension', section: 'other', reference: 'User Dimension 1', inputMode: 'search' },
  { key: 'ndDimension', column: 'User2_ID', type: 'search', label: '2nd Dimension', section: 'other', reference: 'User Dimension 2', inputMode: 'search' },
];
// @sf-generated-end fields:finPaymentScheduleDetail

// @sf-generated-start component:FinPaymentScheduleDetailForm
export default function FinPaymentScheduleDetailForm(props) {
  // @sf-custom-slot hooks:FinPaymentScheduleDetailForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentScheduleDetailForm

// @sf-custom-slot section:FinPaymentScheduleDetailForm-custom
