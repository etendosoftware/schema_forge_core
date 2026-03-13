import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsReceiptLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'movementQty', column: 'MovementQty', type: 'number', required: true, section: 'principal' },
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, section: 'principal', reference: 'Locator', inputMode: 'selector' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:goodsReceiptLine

// @sf-generated-start component:GoodsReceiptLineForm
export default function GoodsReceiptLineForm(props) {
  // @sf-custom-slot hooks:GoodsReceiptLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:GoodsReceiptLineForm

// @sf-custom-slot section:GoodsReceiptLineForm-custom
