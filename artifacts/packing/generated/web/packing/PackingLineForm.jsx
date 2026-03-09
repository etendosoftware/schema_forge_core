import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'weight', label: 'Weight', type: 'number' },
  { key: 'packageNo', label: 'Package No', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function PackingLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
