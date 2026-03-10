import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'rate', column: 'Rate', type: 'number', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'validFrom', column: 'ValidFrom', type: 'date' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function TaxForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
