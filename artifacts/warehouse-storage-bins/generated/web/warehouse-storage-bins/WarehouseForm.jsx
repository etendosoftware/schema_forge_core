import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'searchKey', label: 'Search Key', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'address1', label: 'Address1', type: 'text' },
  { key: 'address2', label: 'Address2', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'regionName', label: 'Region Name', type: 'text' },
  { key: 'postalCode', label: 'Postal Code', type: 'text' },
  { key: 'country', label: 'Country', type: 'text' },
];

export default function WarehouseForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
