import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'searchKey', column: 'Value', type: 'text', required: true },
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'address1', column: 'Address1', type: 'text' },
  { key: 'address2', column: 'Address2', type: 'text' },
  { key: 'city', column: 'City', type: 'text' },
  { key: 'regionName', column: 'RegionName', type: 'text' },
  { key: 'postalCode', column: 'Postal', type: 'text' },
  { key: 'country', column: 'C_Country_ID', type: 'text' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function WarehouseForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
