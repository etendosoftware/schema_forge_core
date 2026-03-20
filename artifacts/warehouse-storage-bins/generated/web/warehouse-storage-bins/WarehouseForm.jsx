import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:warehouse
const fields = [
  { key: 'searchKey', column: 'Value', type: 'text', required: true, section: 'principal' },
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'address1', column: 'Address1', type: 'text', section: 'principal' },
  { key: 'address2', column: 'Address2', type: 'text', section: 'other' },
  { key: 'city', column: 'City', type: 'text', section: 'other' },
  { key: 'regionName', column: 'RegionName', type: 'text', section: 'other' },
  { key: 'postalCode', column: 'Postal', type: 'text', section: 'other' },
  { key: 'country', column: 'C_Country_ID', type: 'text', section: 'other' },
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
