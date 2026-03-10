import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'movementQuantity', column: 'MovementQty', type: 'number', required: true },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'isEndProduct', column: 'IsEndProduct', type: 'checkbox', required: true, readOnly: true },
];

export default function ProductionLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
