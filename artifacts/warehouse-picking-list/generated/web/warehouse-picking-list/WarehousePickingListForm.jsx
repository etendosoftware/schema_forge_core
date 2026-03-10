import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'pickDate', column: 'PickDate', type: 'date', required: true },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'selector', reference: 'User', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'priority', column: 'Priority', type: 'text' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
];

export default function WarehousePickingListForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
