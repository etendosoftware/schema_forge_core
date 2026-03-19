import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoice
const fields = [
  // @sf-custom-slot callout:SE_Invoice_AccountingDate
  { key: 'dateInvoiced', column: 'DateInvoiced', type: 'date', required: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Invoice_BPartner
  { key: 'cBpartnerId', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  // @sf-custom-slot callout:SE_Invoice_BPartnerLocation
  { key: 'cBpartnerLocationId', column: 'C_BPartner_Location_ID', type: 'selector', required: true, section: 'principal', reference: 'BPartner_Location', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Invoice_PriceList
  { key: 'mPriceListId', column: 'M_PriceList_ID', type: 'selector', required: true, section: 'principal', reference: 'PriceList', inputMode: 'selector' },
  // @sf-custom-slot callout:SE_Invoice_TaxDate
  { key: 'dateAcct', column: 'DateAcct', type: 'date', required: true, section: 'other' },
  { key: 'cPaymentTermId', column: 'C_PaymentTerm_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector' },
  // @sf-custom-slot callout:SE_Invoice_BPartner
  { key: 'finPaymentmethodId', column: 'FIN_Paymentmethod_ID', type: 'selector', required: true, section: 'other', reference: 'Paymentmethod', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'cOrderId', column: 'C_Order_ID', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'poreference', column: 'POReference', type: 'text', section: 'other' },
  { key: 'totalpaid', column: 'Totalpaid', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'outstandingAmt', column: 'OutstandingAmt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'dueAmt', column: 'DueAmt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'daysTillDue', column: 'DaysTillDue', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'percentageoverdue', column: 'Percentageoverdue', type: 'number', readOnly: true, section: 'other' },
  { key: 'finalsettlement', column: 'Finalsettlement', type: 'date', readOnly: true, section: 'other' },
  { key: 'daysoutstanding', column: 'Daysoutstanding', type: 'number', readOnly: true, section: 'other' },
  { key: 'emAprmAddpayment', column: 'EM_APRM_Addpayment', type: 'text', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'emAprmProcessinvoice', column: 'EM_APRM_Processinvoice', type: 'text', section: 'other' },
  { key: 'docAction', column: 'DocAction', type: 'text', required: true, section: 'other' },
  { key: 'createfromorders', column: 'Createfromorders', type: 'text', section: 'other' },
  { key: 'createfrominouts', column: 'Createfrominouts', type: 'text', section: 'other' },
  { key: 'copyFrom', column: 'CopyFrom', type: 'text', section: 'other' },
  // @sf-custom-slot callout:SE_Invoice_Project
  { key: 'cProjectId', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'cCostcenterId', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'cCampaignId', column: 'C_Campaign_ID', type: 'selector', section: 'other', reference: 'Campaign', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'user1Id', column: 'User1_ID', type: 'selector', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'user2Id', column: 'User2_ID', type: 'selector', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'emEtcopagCopFeedback', column: 'EM_Etcopag_Cop_Feedback', type: 'text', section: 'other' },
  { key: 'prepaymentamt', column: 'Prepaymentamt', type: 'number', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:invoice

// @sf-generated-start component:InvoiceForm
export default function InvoiceForm(props) {
  // @sf-custom-slot hooks:InvoiceForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceForm

// @sf-custom-slot section:InvoiceForm-custom
