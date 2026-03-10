import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true },
  { key: 'inventoryType', column: 'InventoryType', type: 'text', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
];

export default function InventoryForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
