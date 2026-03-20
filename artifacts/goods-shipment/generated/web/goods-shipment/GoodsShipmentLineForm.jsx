import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsShipmentLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_InOutLine_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', section: 'principal' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeQuantity', column: 'Aumqty', type: 'text', section: 'principal' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', section: 'other', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
  { key: 'movementQuantity', column: 'MovementQty', type: 'text', required: true, section: 'other' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'storageBin', column: 'M_Locator_ID', type: 'dependent', section: 'other', reference: 'Locator', inputMode: 'dependent', dependsOn: { field: 'warehouse', filterKey: 'M_Warehouse_ID' } },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'salesOrderLine', column: 'C_OrderLine_ID', type: 'search', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', section: 'other', reference: 'Asset', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'explode', column: 'Explode', type: 'text', required: true, section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'invoiceQuantity', column: 'Qtyinvoiced', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:goodsShipmentLine

// @sf-generated-start component:GoodsShipmentLineForm
export default function GoodsShipmentLineForm(props) {
  // @sf-custom-slot hooks:GoodsShipmentLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:GoodsShipmentLineForm

// @sf-custom-slot section:GoodsShipmentLineForm-custom
