import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:warehousePickingList
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'pickDate', column: 'PickDate', type: 'date', required: true, section: 'principal' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'principal', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'selector', section: 'principal', reference: 'User', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'priority', column: 'Priority', type: 'text', section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
];
// @sf-generated-end fields:warehousePickingList

// @sf-generated-start component:WarehousePickingListForm
export default function WarehousePickingListForm(props) {
  // @sf-custom-slot hooks:WarehousePickingListForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:WarehousePickingListForm

// @sf-custom-slot section:WarehousePickingListForm-custom
