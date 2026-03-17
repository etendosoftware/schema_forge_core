import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsReceiptLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'movementQty', column: 'MovementQty', type: 'number', required: true, section: 'principal' },
];
// @sf-generated-end fields:goodsReceiptLine

// @sf-generated-start component:GoodsReceiptLineForm
export default function GoodsReceiptLineForm(props) {
  // @sf-custom-slot hooks:GoodsReceiptLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:GoodsReceiptLineForm

// @sf-custom-slot section:GoodsReceiptLineForm-custom
