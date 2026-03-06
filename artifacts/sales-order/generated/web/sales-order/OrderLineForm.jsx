import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'text', required: true },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', required: true },
  { key: 'discount', label: 'Discount', type: 'number' },
  { key: 'tax', label: 'Tax', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function OrderLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
