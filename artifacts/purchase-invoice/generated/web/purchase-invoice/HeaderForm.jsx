import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:header
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'principal' },
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', label: 'Invoice Date', required: true, section: 'principal', defaultValue: '@#Date@' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', label: 'Partner Address', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', label: 'Price List', required: true, section: 'collapsed', reference: 'PriceList', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', label: 'Payment Method', required: true, section: 'collapsed', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'collapsed' },
  { key: 'orderReference', column: 'POReference', type: 'text', label: 'Supplier Reference', section: 'collapsed' },
  { key: 'cashVAT', column: 'Iscashvat', type: 'checkbox', label: 'Cash VAT', required: true, section: 'principal', defaultValue: 'N', readOnlyLogic: (record) => record['processed'] === true },
];
// @sf-generated-end fields:header

// @sf-generated-start component:HeaderForm
export default function HeaderForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
HeaderForm.hasCollapsedFields = true;
// @sf-generated-end component:HeaderForm
