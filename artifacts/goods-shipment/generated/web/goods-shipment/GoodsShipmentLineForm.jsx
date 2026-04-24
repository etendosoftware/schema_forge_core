import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsShipmentLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', section: 'principal', reference: 'Product', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'movementQuantity', column: 'MovementQty', type: 'number', label: 'Movement Quantity', required: true, section: 'principal', defaultValue: 1, readOnlyLogic: (record) => record['processed'] === true || record['uomManagement'] === 'Y' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'orderQuantity', column: 'QuantityOrder', type: 'number', label: 'Order Quantity', readOnly: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
];
// @sf-generated-end fields:goodsShipmentLine

// @sf-generated-start component:GoodsShipmentLineForm
export default function GoodsShipmentLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
GoodsShipmentLineForm.hasCollapsedFields = false;
// @sf-generated-end component:GoodsShipmentLineForm
