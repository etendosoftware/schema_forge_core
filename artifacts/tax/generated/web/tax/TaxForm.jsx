import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'rate', label: 'Rate', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'validFrom', label: 'Valid From', type: 'date' },
];

export default function TaxForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
