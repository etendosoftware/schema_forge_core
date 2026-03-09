import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'locator', label: 'Locator', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'bookQuantity', label: 'Book Quantity', type: 'number', readOnly: true },
  { key: 'countQuantity', label: 'Count Quantity', type: 'number', required: true },
  { key: 'adjustmentQuantity', label: 'Adjustment Quantity', type: 'number', readOnly: true },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function InventoryLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
