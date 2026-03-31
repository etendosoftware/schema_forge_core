import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:quotation
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Quotation Date', required: true, section: 'principal', defaultValue: '@#Date@' },
  // @sf-custom-slot callout:SE_Order_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Order_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', label: 'Partner Address', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'validUntil', column: 'validuntil', type: 'date', label: 'Valid Until', section: 'principal' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', label: 'Payment Method', section: 'collapsed', reference: 'Paymentmethod', inputMode: 'selector' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', label: 'Total Gross Amount', required: true, readOnly: true, section: 'summary' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', label: 'Total Net Amount', required: true, readOnly: true, section: 'summary' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'collapsed' },
];
// @sf-generated-end fields:quotation

// @sf-generated-start component:QuotationForm
export default function QuotationForm(props) {
  // @sf-custom-slot hooks:QuotationForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:QuotationForm

// @sf-custom-slot section:QuotationForm-custom
