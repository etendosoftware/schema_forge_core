import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', label: 'Document No', type: 'text', required: true, readOnly: true },
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'warehouse', label: 'Warehouse', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'reservedQty', label: 'Reserved Qty', type: 'number', required: true },
  { key: 'releasedQty', label: 'Released Qty', type: 'number', readOnly: true },
  { key: 'status', label: 'Status', type: 'text', required: true, readOnly: true },
  { key: 'salesOrderLine', label: 'Sales Order Line', type: 'search', reference: 'SalesOrderLine', inputMode: 'search' },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'attributeSetInstance', label: 'Attribute Set Instance', type: 'selector', reference: 'AttributeSetInstance', inputMode: 'selector' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function ReservationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
