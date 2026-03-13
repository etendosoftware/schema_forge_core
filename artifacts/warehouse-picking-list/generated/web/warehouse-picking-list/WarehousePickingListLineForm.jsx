import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:warehousePickingListLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, section: 'principal', reference: 'Locator', inputMode: 'selector' },
  { key: 'quantityRequired', column: 'QtyRequired', type: 'number', required: true, section: 'principal' },
  { key: 'quantityPicked', column: 'QtyPicked', type: 'number', section: 'other' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'search', section: 'other', reference: 'SalesOrder', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:warehousePickingListLine

// @sf-generated-start component:WarehousePickingListLineForm
export default function WarehousePickingListLineForm(props) {
  // @sf-custom-slot hooks:WarehousePickingListLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:WarehousePickingListLineForm

// @sf-custom-slot section:WarehousePickingListLineForm-custom
