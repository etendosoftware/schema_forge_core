import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'locator', label: 'Locator', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'movementQuantity', label: 'Movement Quantity', type: 'number', required: true },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'isEndProduct', label: 'Is End Product', type: 'checkbox', required: true, readOnly: true },
];

export default function ProductionLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
