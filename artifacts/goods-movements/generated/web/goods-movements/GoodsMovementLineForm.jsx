import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsMovementLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'movementQty', column: 'MovementQty', type: 'number', required: true, section: 'principal' },
  { key: 'locatorFrom', column: 'M_Locator_ID', type: 'selector', required: true, section: 'principal', reference: 'Locator', inputMode: 'selector' },
  { key: 'locatorTo', column: 'M_LocatorTo_ID', type: 'selector', required: true, section: 'principal', reference: 'Locator', inputMode: 'selector' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:goodsMovementLine

// @sf-generated-start component:GoodsMovementLineForm
export default function GoodsMovementLineForm(props) {
  // @sf-custom-slot hooks:GoodsMovementLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:GoodsMovementLineForm

// @sf-custom-slot section:GoodsMovementLineForm-custom
