import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', label: 'Business Partner', type: 'text', required: true },
  { key: 'orderDate', label: 'Order Date', type: 'date', required: true },
  { key: 'warehouse', label: 'Warehouse', type: 'text', required: true },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'deliveryLocation', label: 'Delivery Location', type: 'text' },
  { key: 'invoiceAddress', label: 'Invoice Address', type: 'text' },
];

export default function OrderForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
