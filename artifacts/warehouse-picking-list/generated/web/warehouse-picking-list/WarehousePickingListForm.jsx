import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'pickDate', label: 'Pick Date', type: 'date', required: true },
  { key: 'warehouse', label: 'Warehouse', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'assignedTo', label: 'Assigned To', type: 'selector', reference: 'User', inputMode: 'selector' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'priority', label: 'Priority', type: 'text' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
];

export default function WarehousePickingListForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
