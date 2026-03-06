import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'movementQty', label: 'Movement Qty', type: 'number', required: true },
  { key: 'locatorFrom', label: 'Locator From', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'locatorTo', label: 'Locator To', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function GoodsMovementLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
