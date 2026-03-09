import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', label: 'Business Partner', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', label: 'Partner Address', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'orderDate', label: 'Order Date', type: 'date', required: true },
  { key: 'validUntil', label: 'Valid Until', type: 'date', required: true },
  { key: 'priceList', label: 'Price List', type: 'selector', required: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'selector', required: true, reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'paymentMethod', label: 'Payment Method', type: 'selector', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'invoiceAddress', label: 'Invoice Address', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'poReference', label: 'Po Reference', type: 'text' },
  { key: 'salesRep', label: 'Sales Rep', type: 'search', reference: 'User', inputMode: 'search' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

export default function QuotationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
