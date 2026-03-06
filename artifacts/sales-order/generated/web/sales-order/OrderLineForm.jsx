import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'text', required: true },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', required: true },
  { key: 'tax', label: 'Tax', type: 'text', required: true },
  { key: 'discount', label: 'Discount', type: 'number' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
];

export default function OrderLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
