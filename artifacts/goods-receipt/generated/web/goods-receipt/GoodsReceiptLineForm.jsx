import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsReceiptLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', section: 'principal', reference: 'Product', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', label: 'Attribute Set Value', section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM', required: true, readOnly: true, section: 'principal', reference: 'UOM', inputMode: 'selector', readOnlyLogic: (record) => record['uomManagement'] === 'Y' },
  { key: 'movementQuantity', column: 'MovementQty', type: 'number', label: 'Movement Quantity', required: true, section: 'principal', defaultValue: '0', readOnlyLogic: (record) => record['processed'] === true || record['uomManagement'] === 'Y' },
  { key: 'storageBin', column: 'M_Locator_ID', type: 'selector', label: 'Storage Bin', section: 'principal', reference: 'Locator', inputMode: 'selector', defaultValue: '@OnHandLocatorDefault@', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'principal' },
];
// @sf-generated-end fields:goodsReceiptLine

// @sf-generated-start component:GoodsReceiptLineForm
export default function GoodsReceiptLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:GoodsReceiptLineForm
