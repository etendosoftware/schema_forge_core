import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:returnShipmentLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'movementQty', column: 'MovementQty', type: 'number', required: true, section: 'principal' },
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, section: 'principal', reference: 'Locator', inputMode: 'selector' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'returnOrderLine', column: 'C_OrderLine_ID', type: 'dependent', section: 'other', reference: 'PurchaseOrderLine', inputMode: 'dependent', dependsOn: { field: 'returnShipment.orderReference', filterKey: 'cOrderId' } },
  { key: 'rmaLine', column: 'M_RMALine_ID', type: 'dependent', section: 'other', reference: 'ReturnMaterialAuthorizationLine', inputMode: 'dependent', dependsOn: { field: 'returnShipment.returnReason', filterKey: 'mRmaId' } },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:returnShipmentLine

// @sf-generated-start component:ReturnShipmentLineForm
export default function ReturnShipmentLineForm(props) {
  // @sf-custom-slot hooks:ReturnShipmentLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ReturnShipmentLineForm

// @sf-custom-slot section:ReturnShipmentLineForm-custom
