import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:header
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SE_Invoice_AccountingDate
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', required: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Invoice_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Invoice_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector' },
  // @sf-custom-slot callout:SE_Invoice_BPartner
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'paymentComplete', column: 'Ispaid', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'totalPaid', column: 'Totalpaid', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'aPRMAddpayment', column: 'EM_APRM_Addpayment', type: 'text', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'aPRMProcessinvoice', column: 'EM_APRM_Processinvoice', type: 'text', section: 'other' },
  { key: 'documentAction', column: 'DocAction', type: 'text', required: true, section: 'other' },
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'createLinesFromOrder', column: 'Createfromorders', type: 'text', section: 'other' },
  { key: 'createLinesFromShipment', column: 'Createfrominouts', type: 'text', section: 'other' },
  { key: 'copyFrom', column: 'CopyFrom', type: 'text', section: 'other' },
  { key: 'dueAmount', column: 'DueAmt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'daysTillDue', column: 'DaysTillDue', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'percentageOverdue', column: 'Percentageoverdue', type: 'number', readOnly: true, section: 'other' },
  { key: 'finalSettlementDate', column: 'Finalsettlement', type: 'date', readOnly: true, section: 'other' },
  { key: 'daysSalesOutstanding', column: 'Daysoutstanding', type: 'number', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_PriceList
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, section: 'other', reference: 'PriceList', inputMode: 'selector' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'search', section: 'other', reference: 'User', inputMode: 'search' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'orderReference', column: 'POReference', type: 'text', section: 'other' },
  // @sf-custom-slot callout:SE_Invoice_TaxDate
  { key: 'accountingDate', column: 'DateAcct', type: 'date', required: true, section: 'other' },
  { key: 'calculatePromotions', column: 'Calculate_Promotions', type: 'text', section: 'other' },
  { key: 'externalBusinessPartnerReference', column: 'BPartner_ExtRef', type: 'text', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SE_Invoice_Project
  { key: 'project', column: 'C_Project_ID', type: 'dependent', section: 'other', reference: 'Project', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'salesCampaign', column: 'C_Campaign_ID', type: 'selector', section: 'other', reference: 'Campaign', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'prepaymentamt', column: 'Prepaymentamt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'paidAmountAtInvoicing', column: 'Paidamtatinvoicing', type: 'number', readOnly: true, section: 'other' },
  { key: 'withholdingamount', column: 'Withholdingamount', type: 'number', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
];
// @sf-generated-end fields:header

// @sf-generated-start component:HeaderForm
export default function HeaderForm(props) {
  // @sf-custom-slot hooks:HeaderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:HeaderForm

// @sf-custom-slot section:HeaderForm-custom
