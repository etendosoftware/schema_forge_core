import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'listPrice', label: 'List Price', type: 'number', required: true },
  { key: 'standardPrice', label: 'Standard Price', type: 'number', required: true },
  { key: 'limitPrice', label: 'Limit Price', type: 'number' },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function PriceListLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
