import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:inventoryLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, section: 'principal', reference: 'Locator', inputMode: 'selector' },
  { key: 'bookQuantity', column: 'QtyBook', type: 'number', readOnly: true, section: 'other' },
  { key: 'countQuantity', column: 'QtyCount', type: 'number', required: true, section: 'principal' },
  { key: 'adjustmentQuantity', column: 'QtyAdjust', type: 'number', readOnly: true, section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:inventoryLine

// @sf-generated-start component:InventoryLineForm
export default function InventoryLineForm(props) {
  // @sf-custom-slot hooks:InventoryLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InventoryLineForm

// @sf-custom-slot section:InventoryLineForm-custom
