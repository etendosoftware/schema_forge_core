import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lines
const fields = [
  { key: 'dueDate', column: 'DueDate', type: 'date', readOnly: true, section: 'other' },
  { key: 'invoiceAmount', column: 'InvoiceAmount', type: 'number', readOnly: true, section: 'other' },
  { key: 'expected', column: 'ExpectedAmount', type: 'number', readOnly: true, section: 'other' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'principal' },
  { key: 'orderNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'orderPaymentSchedule', column: 'FIN_Payment_Schedule_Order', type: 'search', section: 'principal', reference: 'Payment_Schedule', inputMode: 'search' },
  { key: 'invoiceNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'invoicePaymentSchedule', column: 'FIN_Payment_Schedule_Invoice', type: 'search', section: 'principal', reference: 'Payment_Schedule', inputMode: 'search' },
  { key: 'gLItem', column: 'C_Glitem_ID', type: 'selector', section: 'principal', reference: 'Glitem', inputMode: 'selector' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', readOnly: true, section: 'other', reference: 'BusinessPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'activity', column: 'C_Activity_ID', type: 'selector', section: 'other', reference: 'Activity', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'product', column: 'M_Product_ID', type: 'search', section: 'other', reference: 'Product', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'salesCampaign', column: 'C_Campaign_ID', type: 'selector', section: 'other', reference: 'Campaign', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'salesRegion', column: 'C_Salesregion_ID', type: 'selector', section: 'other', reference: 'SalesRegion', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'CostCenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'UserDimension1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'UserDimension2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
];
// @sf-generated-end fields:lines

// @sf-generated-start component:LinesForm
export default function LinesForm(props) {
  // @sf-custom-slot hooks:LinesForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LinesForm

// @sf-custom-slot section:LinesForm-custom
