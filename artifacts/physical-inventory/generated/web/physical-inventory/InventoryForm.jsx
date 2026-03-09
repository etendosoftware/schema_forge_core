import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'warehouse', label: 'Warehouse', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'movementDate', label: 'Movement Date', type: 'date', required: true },
  { key: 'inventoryType', label: 'Inventory Type', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
];

export default function InventoryForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
