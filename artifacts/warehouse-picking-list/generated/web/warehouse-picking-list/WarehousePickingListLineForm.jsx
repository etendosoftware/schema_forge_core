import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'locator', label: 'Locator', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'quantityRequired', label: 'Quantity Required', type: 'number', required: true },
  { key: 'quantityPicked', label: 'Quantity Picked', type: 'number' },
  { key: 'salesOrder', label: 'Sales Order', type: 'search', reference: 'SalesOrder', inputMode: 'search' },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function WarehousePickingListLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
