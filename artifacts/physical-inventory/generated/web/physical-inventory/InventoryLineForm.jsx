import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'bookQuantity', column: 'QtyBook', type: 'number', readOnly: true },
  { key: 'countQuantity', column: 'QtyCount', type: 'number', required: true },
  { key: 'adjustmentQuantity', column: 'QtyAdjust', type: 'number', readOnly: true },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function InventoryLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
