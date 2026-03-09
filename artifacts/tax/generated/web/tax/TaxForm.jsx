import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'rate', label: 'Rate', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'validFrom', label: 'Valid From', type: 'date' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function TaxForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
