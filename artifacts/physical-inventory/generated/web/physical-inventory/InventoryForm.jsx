import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:inventory
const fields = [
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'principal', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true, section: 'principal' },
  { key: 'inventoryType', column: 'InventoryType', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:inventory

// @sf-generated-start component:InventoryForm
export default function InventoryForm(props) {
  // @sf-custom-slot hooks:InventoryForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InventoryForm

// @sf-custom-slot section:InventoryForm-custom
