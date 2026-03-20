import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoice
const fields = [
  // @sf-custom-slot callout:SE_Invoice_AccountingDate
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', label: 'Invoice Date', required: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Invoice_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'principal', reference: 'BPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  // @sf-custom-slot callout:SE_Invoice_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', label: 'Partner Address', required: true, section: 'principal', reference: 'BPartner_Location', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  // @sf-custom-slot callout:SL_Invoice_PriceList
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', label: 'Price List', required: true, section: 'principal', reference: 'PriceList', inputMode: 'selector' },
  // @sf-custom-slot callout:SE_Invoice_TaxDate
  { key: 'accountingDate', column: 'DateAcct', type: 'date', label: 'Accounting Date', required: true, section: 'other' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', label: 'Payment Terms', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector' },
  // @sf-custom-slot callout:SE_Invoice_BPartner
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', label: 'Payment Method', required: true, section: 'other', reference: 'Paymentmethod', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'search', label: 'Purchase Order', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'orderReference', column: 'POReference', type: 'text', label: 'Supplier Reference', section: 'other' },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', label: 'Document Status', required: true, readOnly: true, section: 'other' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', label: 'Total Gross Amount', required: true, readOnly: true, section: 'other' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', label: 'Total Net Amount', required: true, readOnly: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', label: 'Currency', required: true, readOnly: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'paymentComplete', column: 'Ispaid', type: 'checkbox', label: 'Payment Complete', required: true, readOnly: true, section: 'other' },
  { key: 'totalPaid', column: 'Totalpaid', type: 'number', label: 'Total Paid', required: true, readOnly: true, section: 'other' },
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'number', label: 'Total Outstanding', required: true, readOnly: true, section: 'other' },
  { key: 'dueAmount', column: 'DueAmt', type: 'number', label: 'Amount Currently Due', required: true, readOnly: true, section: 'other' },
  { key: 'daysTillDue', column: 'DaysTillDue', type: 'number', label: 'Days Till Next Due', required: true, readOnly: true, section: 'other' },
  { key: 'percentageOverdue', column: 'Percentageoverdue', type: 'number', label: 'Percentage Paid Late', readOnly: true, section: 'other' },
  { key: 'finalSettlementDate', column: 'Finalsettlement', type: 'date', label: 'Paid In Full Date', readOnly: true, section: 'other' },
  { key: 'daysSalesOutstanding', column: 'Daysoutstanding', type: 'number', label: 'Days to Pay in Full', readOnly: true, section: 'other' },
  { key: 'aPRMAddpayment', column: 'EM_APRM_Addpayment', type: 'text', label: 'Add Payment', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'aPRMProcessinvoice', column: 'EM_APRM_Processinvoice', type: 'text', label: 'Process Invoices', section: 'other' },
  { key: 'documentAction', column: 'DocAction', type: 'text', label: 'Process Invoice', required: true, section: 'other' },
  { key: 'createLinesFromOrder', column: 'Createfromorders', type: 'text', label: 'Create Lines From Order', section: 'other' },
  { key: 'createLinesFromShipment', column: 'Createfrominouts', type: 'text', label: 'Create Lines From Receipt', section: 'other' },
  { key: 'copyFrom', column: 'CopyFrom', type: 'text', label: 'Copy Lines', section: 'other' },
  // @sf-custom-slot callout:SE_Invoice_Project
  { key: 'project', column: 'C_Project_ID', type: 'dependent', label: 'Project', section: 'other', reference: 'Project', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'salesCampaign', column: 'C_Campaign_ID', type: 'selector', label: 'Sales Campaign', section: 'other', reference: 'Campaign', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', label: '1st Dimension', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', label: '2nd Dimension', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'etcopagCopilotFeedback', column: 'EM_Etcopag_Cop_Feedback', type: 'text', label: 'Copilot Feedback', section: 'other' },
  { key: 'prepaymentamt', column: 'Prepaymentamt', type: 'number', label: 'Prepayment Amount', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:invoice

// @sf-generated-start component:InvoiceForm
export default function InvoiceForm(props) {
  // @sf-custom-slot hooks:InvoiceForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceForm

// @sf-custom-slot section:InvoiceForm-custom
