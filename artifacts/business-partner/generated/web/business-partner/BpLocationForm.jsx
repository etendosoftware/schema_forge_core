import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'postalCode', label: 'Postal Code', type: 'text' },
  { key: 'country', label: 'Country', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
];

export default function BpLocationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
