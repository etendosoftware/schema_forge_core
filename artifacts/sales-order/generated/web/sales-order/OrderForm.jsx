import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', label: 'Business Partner', type: 'text', required: true },
  { key: 'partnerAddress', label: 'Partner Address', type: 'text', required: true },
  { key: 'orderDate', label: 'Order Date', type: 'date', required: true },
  { key: 'datePromised', label: 'Date Promised', type: 'date', required: true },
  { key: 'warehouse', label: 'Warehouse', type: 'text', required: true },
  { key: 'priceList', label: 'Price List', type: 'text', required: true },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'text', required: true },
  { key: 'paymentMethod', label: 'Payment Method', type: 'text' },
  { key: 'invoiceAddress', label: 'Invoice Address', type: 'text', required: true },
  { key: 'deliveryLocation', label: 'Delivery Location', type: 'text' },
  { key: 'poReference', label: 'Po Reference', type: 'text' },
  { key: 'salesRep', label: 'Sales Rep', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function OrderForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
