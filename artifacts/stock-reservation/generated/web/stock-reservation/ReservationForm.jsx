import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'reservedQty', column: 'Quantity', type: 'number', required: true },
  { key: 'releasedQty', column: 'ReleasedQty', type: 'number', readOnly: true },
  { key: 'status', column: 'RESStatus', type: 'text', required: true, readOnly: true },
  { key: 'salesOrderLine', column: 'C_OrderLine_ID', type: 'search', reference: 'SalesOrderLine', inputMode: 'search' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'attributeSetInstance', column: 'M_AttributeSetInstance_ID', type: 'selector', reference: 'AttributeSetInstance', inputMode: 'selector' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function ReservationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
