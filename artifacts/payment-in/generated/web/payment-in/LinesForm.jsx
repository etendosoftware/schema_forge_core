import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lines
const fields = [
  { key: 'dueDate', column: 'DueDate', type: 'date', readOnly: true, section: 'other' },
  { key: 'invoiceAmount', column: 'InvoiceAmount', type: 'number', readOnly: true, section: 'other' },
  { key: 'expected', column: 'ExpectedAmount', type: 'number', readOnly: true, section: 'other' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'principal' },
  { key: 'orderPaymentSchedule', column: 'FIN_Payment_Schedule_Order', type: 'search', section: 'principal', inputMode: 'search' },
  { key: 'invoicePaymentSchedule', column: 'FIN_Payment_Schedule_Invoice', type: 'search', section: 'principal', inputMode: 'search' },
  { key: 'gLItem', column: 'C_Glitem_ID', type: 'search', section: 'principal', inputMode: 'search' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', required: true, section: 'other' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', section: 'other', inputMode: 'search' },
  { key: 'activity', column: 'C_Activity_ID', type: 'search', section: 'other', reference: 'Activity selector', inputMode: 'search' },
  { key: 'product', column: 'M_Product_ID', type: 'search', section: 'other', inputMode: 'search' },
  { key: 'salesCampaign', column: 'C_Campaign_ID', type: 'search', section: 'other', reference: 'Campaign selector', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', inputMode: 'search' },
  { key: 'salesRegion', column: 'C_Salesregion_ID', type: 'search', section: 'other', reference: 'Sales region selector', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', section: 'other', reference: 'Cost Center Selector', inputMode: 'search' },
  { key: 'stDimension', column: 'User1_ID', type: 'search', section: 'other', reference: 'User Dimension 1', inputMode: 'search' },
  { key: 'ndDimension', column: 'User2_ID', type: 'search', section: 'other', reference: 'User Dimension 2', inputMode: 'search' },
];
// @sf-generated-end fields:lines

// @sf-generated-start component:LinesForm
export default function LinesForm(props) {
  // @sf-custom-slot hooks:LinesForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LinesForm

// @sf-custom-slot section:LinesForm-custom
