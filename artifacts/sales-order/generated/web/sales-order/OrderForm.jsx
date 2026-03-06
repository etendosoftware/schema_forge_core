import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', label: 'Business Partner', type: 'search', required: true, reference: 'BusinessPartner' },
  { key: 'partnerAddress', label: 'Partner Address', type: 'search', required: true, reference: 'BusinessPartnerLocation' },
  { key: 'orderDate', label: 'Order Date', type: 'date', required: true },
  { key: 'datePromised', label: 'Date Promised', type: 'date', required: true },
  { key: 'warehouse', label: 'Warehouse', type: 'search', required: true, reference: 'Warehouse' },
  { key: 'priceList', label: 'Price List', type: 'search', required: true, reference: 'PriceList' },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'search', required: true, reference: 'PaymentTerm' },
  { key: 'paymentMethod', label: 'Payment Method', type: 'search', reference: 'PaymentMethod' },
  { key: 'invoiceAddress', label: 'Invoice Address', type: 'search', required: true, reference: 'BusinessPartnerLocation' },
  { key: 'deliveryLocation', label: 'Delivery Location', type: 'text' },
  { key: 'poReference', label: 'Po Reference', type: 'text' },
  { key: 'salesRep', label: 'Sales Rep', type: 'search', reference: 'User' },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function OrderForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
