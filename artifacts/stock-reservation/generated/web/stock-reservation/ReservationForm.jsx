import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:reservation
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'principal', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'reservedQty', column: 'Quantity', type: 'number', required: true, section: 'principal' },
  { key: 'releasedQty', column: 'ReleasedQty', type: 'number', readOnly: true, section: 'other' },
  { key: 'status', column: 'RESStatus', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'salesOrderLine', column: 'C_OrderLine_ID', type: 'search', section: 'principal', reference: 'SalesOrderLine', inputMode: 'search' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'attributeSetInstance', column: 'M_AttributeSetInstance_ID', type: 'selector', section: 'other', reference: 'AttributeSetInstance', inputMode: 'selector' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:reservation

// @sf-generated-start component:ReservationForm
export default function ReservationForm(props) {
  // @sf-custom-slot hooks:ReservationForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ReservationForm

// @sf-custom-slot section:ReservationForm-custom
