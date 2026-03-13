import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:warehouse
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'searchKey', column: 'Value', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:warehouse

// @sf-generated-start component:WarehouseForm
export default function WarehouseForm(props) {
  // @sf-custom-slot hooks:WarehouseForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:WarehouseForm

// @sf-custom-slot section:WarehouseForm-custom
