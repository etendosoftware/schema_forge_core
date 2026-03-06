import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'warehouse', label: 'Warehouse', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'reservedQty', label: 'Reserved Qty', type: 'number', required: true },
  { key: 'salesOrderLine', label: 'Sales Order Line', type: 'search', reference: 'SalesOrderLine', inputMode: 'search' },
  { key: 'attributeSetInstance', label: 'Attribute Set Instance', type: 'selector', reference: 'AttributeSetInstance', inputMode: 'selector' },
];

export default function ReservationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
