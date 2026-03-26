import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:quotation
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Order_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Order_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  // @sf-custom-slot callout:SL_Order_PriceList
  { key: 'priceList', column: 'M_PriceList_ID', type: 'search', required: true, section: 'principal', reference: 'PriceList', inputMode: 'search' },
  { key: 'validUntil', column: 'validuntil', type: 'date', section: 'principal' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', section: 'other', reference: 'Paymentmethod', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'search', required: true, section: 'principal', reference: 'PaymentTerm', inputMode: 'search' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true, section: 'principal' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true, section: 'summary' },
  { key: 'orderReference', column: 'POReference', type: 'text', section: 'other' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'selector', section: 'other', reference: 'SalesRepresentative', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
];
// @sf-generated-end fields:quotation

// @sf-generated-start component:QuotationForm
export default function QuotationForm(props) {
  // @sf-custom-slot hooks:QuotationForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:QuotationForm

// @sf-custom-slot section:QuotationForm-custom
