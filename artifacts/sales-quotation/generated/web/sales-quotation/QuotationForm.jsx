import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:quotation
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Quotation Date', required: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Order_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Order_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', label: 'Partner Address', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  // @sf-custom-slot callout:SL_Order_PriceList
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', label: 'Price List', required: true, section: 'principal', reference: 'PriceList', inputMode: 'selector' },
  { key: 'validUntil', column: 'validuntil', type: 'date', label: 'Valid Until', section: 'other' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', label: 'Payment Method', section: 'other', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', label: 'Payment Terms', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', label: 'Warehouse', required: true, section: 'other', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'rejectReason', column: 'C_Reject_Reason_ID', type: 'selector', label: 'Reject Reason', section: 'other', reference: 'Reject_Reason', inputMode: 'selector' },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', label: 'Document Status', required: true, readOnly: true, section: 'other' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', label: 'Total Gross Amount', required: true, readOnly: true, section: 'other' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', label: 'Total Net Amount', required: true, readOnly: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'search', label: 'Currency', required: true, readOnly: true, section: 'other' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'search', label: 'Sales Representative', section: 'other', reference: 'User', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'documentAction', column: 'DocAction', type: 'text', label: 'Process Order', required: true, section: 'other' },
  { key: 'createOrder', column: 'Convertquotation', type: 'text', label: 'Create Order', section: 'other' },
  // @sf-custom-slot callout:SE_Order_Project
  { key: 'project', column: 'C_Project_ID', type: 'dependent', label: 'Project', section: 'other', reference: 'Project', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
];
// @sf-generated-end fields:quotation

// @sf-generated-start component:QuotationForm
export default function QuotationForm(props) {
  // @sf-custom-slot hooks:QuotationForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:QuotationForm

// @sf-custom-slot section:QuotationForm-custom
